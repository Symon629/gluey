/**
 * SecureStore doesn't exist on web, so the browser build keeps the session in
 * localStorage, which is the standard for Supabase web apps. Guarded for the
 * static (server) render, where `window` is undefined.
 */
const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;

export const sessionStorage = {
  async getItem(key: string) {
    return hasStorage() ? window.localStorage.getItem(key) : null;
  },
  async setItem(key: string, value: string) {
    if (hasStorage()) window.localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (hasStorage()) window.localStorage.removeItem(key);
  },
};
