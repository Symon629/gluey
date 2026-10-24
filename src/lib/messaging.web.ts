// SMS and contacts are only available on iOS and Android.

export type ContactMatch = { name: string; phone: string };

export const smsSupported = false;

export function looksLikePhone(value: string): boolean {
  return /^\+?[\d\s().-]{6,}$/.test(value.trim());
}

export async function findContacts(
  _query: string
): Promise<{ status: 'ok' | 'denied' | 'unavailable'; matches: ContactMatch[] }> {
  return { status: 'unavailable', matches: [] };
}

export async function pickContact(): Promise<ContactMatch | null> {
  return null;
}

export type ComposeResult = 'sent' | 'cancelled' | 'unknown' | 'unavailable';

export async function composeSms(_phones: string[], _body: string): Promise<ComposeResult> {
  return 'unavailable';
}
