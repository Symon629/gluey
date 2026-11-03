// Server only: import this from src/app/api/*+api.ts files, never from app code.
import { MongoClient, type Collection } from 'mongodb';

export type ChatDoc = {
  userId: string;
  /** The id the app gave the message. Unique per user. */
  messageId: string;
  role: 'user' | 'assistant';
  text: string;
  choices?: { id: string; label: string }[];
  card?: Record<string, unknown>;
  createdAt: Date;
};

let clientPromise: Promise<MongoClient> | null = null;
let indexesReady: Promise<unknown> | null = null;

/** The chats collection. Reads MONGODB_URI from the server environment (.env.local). */
export async function chatsCollection(): Promise<Collection<ChatDoc>> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  // Reuse one connection pool across requests (and across dev-server reloads).
  clientPromise ??= new MongoClient(uri, { maxPoolSize: 10 }).connect().catch((error) => {
    clientPromise = null;
    throw error;
  });
  const client = await clientPromise;
  const collection = client.db(process.env.MONGODB_DB || 'gluey').collection<ChatDoc>('chats');

  indexesReady ??= Promise.all([
    collection.createIndex({ userId: 1, messageId: 1 }, { unique: true }),
    collection.createIndex({ userId: 1, createdAt: -1 }),
  ]).catch((error) => {
    indexesReady = null;
    console.warn('[mongo] Could not create indexes:', error);
  });
  await indexesReady;
  return collection;
}
