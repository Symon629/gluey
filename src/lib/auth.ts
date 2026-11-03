import type { Session } from '@supabase/supabase-js';

import { setState } from '@/lib/store';
import { supabase, supabaseConfigured } from '@/lib/supabase/client';
import { clearUserData, flushPendingWrites, loadUserData } from '@/lib/sync';

let loadedUserId: string | null = null;
let started = false;

function applySession(session: Session | null) {
  const user = session?.user ?? null;
  setState({ user: user ? { id: user.id, email: user.email ?? null } : null, authReady: true });

  if (user && user.id !== loadedUserId) {
    if (loadedUserId) clearUserData();
    loadedUserId = user.id;
    void loadUserData();
  } else if (!user && loadedUserId) {
    loadedUserId = null;
    clearUserData();
  }
}

/** Restore the saved session and follow sign-in / sign-out from then on. */
export function startAuth() {
  if (started) return;
  started = true;
  if (!supabaseConfigured) {
    console.warn('[auth] Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local');
    setState({ authReady: true });
    return;
  }
  supabase.auth.onAuthStateChange((_event, session) => {
    // Supabase calls made inside this callback can deadlock, so run them afterwards.
    setTimeout(() => applySession(session), 0);
  });
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? error.message : null;
}

/** Returns an error message, or `confirmEmail: true` when the project requires email confirmation. */
export async function signUp(email: string, password: string): Promise<{ error: string | null; confirmEmail: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { error: error.message, confirmEmail: false };
  return { error: null, confirmEmail: !data.session };
}

export async function signOut() {
  await flushPendingWrites().catch(() => {});
  await supabase.auth.signOut();
}
