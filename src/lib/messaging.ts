import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import * as SMS from 'expo-sms';

export type ContactMatch = { name: string; phone: string };

export const smsSupported = true;

export function looksLikePhone(value: string): boolean {
  return /^\+?[\d\s().-]{6,}$/.test(value.trim());
}

const FIELDS = [ContactField.FULL_NAME, ContactField.PHONES] as const;

function flatten(
  contacts: { fullName?: string | null; phones?: { number?: string | null; label?: string | null }[] | null }[]
): ContactMatch[] {
  const seen = new Set<string>();
  const matches: ContactMatch[] = [];
  for (const contact of contacts) {
    const name = contact.fullName?.trim() || 'Unknown';
    const phones = [...(contact.phones ?? [])].sort(
      (a, b) => Number(/mobile|cell|iphone/i.test(b.label ?? '')) - Number(/mobile|cell|iphone/i.test(a.label ?? ''))
    );
    for (const phone of phones) {
      const number = phone.number?.trim();
      if (!number) continue;
      const key = number.replace(/\D/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ name, phone: number });
    }
  }
  return matches;
}

export async function findContacts(
  query: string
): Promise<{ status: 'ok' | 'denied' | 'unavailable'; matches: ContactMatch[] }> {
  try {
    const permission = await requestPermissionsAsync();
    if (permission.status !== 'granted') return { status: 'denied', matches: [] };
    const results = await Contact.getAllDetails(FIELDS, { name: query, limit: 15 });
    return { status: 'ok', matches: flatten(results).slice(0, 6) };
  } catch (error) {
    console.warn('Contact lookup failed', error);
    return { status: 'unavailable', matches: [] };
  }
}

/** Open the system contact picker. Returns the chosen contact's first phone number. */
export async function pickContact(): Promise<ContactMatch | null> {
  try {
    const contact = await Contact.presentPicker();
    if (!contact) return null;
    const details = await contact.getDetails(FIELDS);
    return flatten([details])[0] ?? null;
  } catch (error) {
    console.warn('Contact picker failed', error);
    return null;
  }
}

export type ComposeResult = 'sent' | 'cancelled' | 'unknown' | 'unavailable';

/** Open the SMS app with recipients and text filled in. The user taps send. */
export async function composeSms(phones: string[], body: string): Promise<ComposeResult> {
  try {
    if (!(await SMS.isAvailableAsync())) return 'unavailable';
    const { result } = await SMS.sendSMSAsync(phones, body);
    return result;
  } catch (error) {
    console.warn('SMS compose failed', error);
    return 'unavailable';
  }
}
