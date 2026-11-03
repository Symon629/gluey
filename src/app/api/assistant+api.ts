import Anthropic from '@anthropic-ai/sdk';

import {
  INTERPRETATION_SCHEMA,
  SYSTEM_PROMPT,
  buildUserPrompt,
  sanitizeInterpretation,
} from '@/lib/assistant/schema';
import type { AssistantRequest } from '@/lib/assistant/types';
import { requireUser } from '@/lib/server/auth';

const MODEL = 'claude-opus-5-5';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  // Credentials come from the server environment (ANTHROPIC_API_KEY in .env.local).
  // They never reach the app bundle.
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

function isValidRequest(body: unknown): body is AssistantRequest {
  const b = body as Partial<AssistantRequest> | null;
  return (
    !!b &&
    typeof b.message === 'string' &&
    b.message.trim().length > 0 &&
    b.message.length <= 4000 &&
    typeof b.now === 'string'
  );
}

export async function POST(request: Request) {
  // Only signed-in users can spend the Anthropic key.
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!isValidRequest(body)) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  const payload: AssistantRequest = {
    message: body.message.trim(),
    now: body.now,
    weekday: String(body.weekday ?? ''),
    timezone: String(body.timezone ?? 'UTC'),
    noteTitles: (Array.isArray(body.noteTitles) ? body.noteTitles : []).slice(0, 100).map(String),
    upcoming: (Array.isArray(body.upcoming) ? body.upcoming : []).slice(0, 25).map(String),
    history: (Array.isArray(body.history) ? body.history : []).slice(-10).map((turn) => ({
      role: turn?.role === 'assistant' ? 'assistant' : 'user',
      text: String(turn?.text ?? '').slice(0, 1000),
    })),
  };

  try {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      // If a safety classifier declines, retry on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: INTERPRETATION_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(payload) }],
    });

    if (response.stop_reason === 'refusal') {
      return Response.json({ reply: "Sorry, I can't help with that one.", intents: [] });
    }
    if (response.stop_reason === 'max_tokens') {
      return Response.json({ error: 'incomplete' }, { status: 502 });
    }
    const text = response.content.find((block) => block.type === 'text');
    if (!text || text.type !== 'text') {
      return Response.json({ error: 'empty_response' }, { status: 502 });
    }
    return Response.json(sanitizeInterpretation(JSON.parse(text.text)));
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error('[assistant] Claude credentials rejected:', error.message);
      return Response.json({ error: 'not_configured' }, { status: 503 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: 'rate_limited' }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[assistant] Claude API error ${error.status}:`, error.message);
      return Response.json({ error: 'upstream_error' }, { status: 502 });
    }
    if (error instanceof SyntaxError) {
      console.error('[assistant] Could not parse model output');
      return Response.json({ error: 'bad_output' }, { status: 502 });
    }
    // Most often: no API key configured on the server.
    console.error('[assistant] Claude unavailable:', error instanceof Error ? error.message : error);
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }
}
