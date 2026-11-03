import { requireUser } from '@/lib/server/auth';
import { chatsCollection, type ChatDoc } from '@/lib/server/mongo';
import type { ChatMessage } from '@/lib/types';

const MAX_MESSAGES = 300;

function str(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length <= max ? value : null;
}

/** Validate one message from the app and turn it into a database document. */
function toDoc(userId: string, input: unknown): ChatDoc | null {
  const m = input as Partial<ChatMessage> | null;
  const messageId = str(m?.id, 64);
  const text = str(m?.text, 8000);
  const createdAt = new Date(String(m?.createdAt ?? ''));
  if (!m || !messageId || text == null || (m.role !== 'user' && m.role !== 'assistant')) return null;
  if (Number.isNaN(createdAt.getTime())) return null;

  const doc: ChatDoc = { userId, messageId, role: m.role, text, createdAt };
  if (Array.isArray(m.choices)) {
    doc.choices = m.choices
      .slice(0, 12)
      .map((c) => ({ id: String(c?.id ?? '').slice(0, 64), label: String(c?.label ?? '').slice(0, 200) }));
  }
  if (m.card && typeof m.card === 'object' && JSON.stringify(m.card).length <= 1000) {
    doc.card = m.card as Record<string, unknown>;
  }
  return doc;
}

function toMessage(doc: ChatDoc): ChatMessage {
  return {
    id: doc.messageId,
    role: doc.role,
    text: doc.text,
    createdAt: doc.createdAt.toISOString(),
    ...(doc.choices ? { choices: doc.choices } : {}),
    ...(doc.card ? { card: doc.card as ChatMessage['card'] } : {}),
  };
}

function databaseError(error: unknown) {
  console.error('[chats] MongoDB error:', error instanceof Error ? error.message : error);
  const notConfigured = error instanceof Error && error.message.includes('MONGODB_URI');
  return Response.json(
    { error: notConfigured ? 'not_configured' : 'database_error' },
    { status: notConfigured ? 503 : 502 }
  );
}

/** The signed-in user's latest messages, oldest first. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const chats = await chatsCollection();
    const docs = await chats
      .find({ userId: auth.userId })
      .sort({ createdAt: -1 })
      .limit(MAX_MESSAGES)
      .toArray();
    return Response.json({ messages: docs.reverse().map(toMessage) });
  } catch (error) {
    return databaseError(error);
  }
}

/** Save messages: `{ message }` or `{ messages: [...] }`. Saving the same id twice is a no-op. */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  let body: { message?: unknown; messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const inputs = Array.isArray(body?.messages) ? body.messages : [body?.message];
  if (inputs.length === 0 || inputs.length > MAX_MESSAGES) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const docs = inputs.map((input) => toDoc(auth.userId, input));
  if (docs.some((doc) => doc == null)) {
    return Response.json({ error: 'invalid_message' }, { status: 400 });
  }

  try {
    const chats = await chatsCollection();
    await chats.bulkWrite(
      (docs as ChatDoc[]).map((doc) => ({
        updateOne: {
          filter: { userId: doc.userId, messageId: doc.messageId },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    return Response.json({ saved: docs.length });
  } catch (error) {
    return databaseError(error);
  }
}

/** Clear the signed-in user's chat history. */
export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const chats = await chatsCollection();
    const result = await chats.deleteMany({ userId: auth.userId });
    return Response.json({ deleted: result.deletedCount });
  } catch (error) {
    return databaseError(error);
  }
}
