import { getAccessToken } from '@/lib/supabase/client';

/** fetch() for our own /api routes, signed with the user's Supabase access token. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  // Relative URLs resolve to the Expo dev server in development, and to the
  // expo-router "origin" in production builds.
  return fetch(path, { ...init, headers });
}
