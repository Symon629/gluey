// Server only: import this from src/app/api/*+api.ts files, never from app code.
import { createClient } from '@supabase/supabase-js';

let verifier: ReturnType<typeof createClient> | null = null;

function getVerifier() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  verifier ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return verifier;
}

/**
 * Returns the signed-in user's id from the request's `Authorization: Bearer <jwt>`
 * header, or a 401/503 Response to send back. The token is verified against
 * Supabase (signature + expiry), so a client can't pretend to be another user.
 */
export async function requireUser(request: Request): Promise<{ userId: string } | Response> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const client = getVerifier();
  if (!client) {
    console.error('[auth] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set');
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }

  const { data, error } = await client.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || typeof userId !== 'string' || !userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return { userId };
}
