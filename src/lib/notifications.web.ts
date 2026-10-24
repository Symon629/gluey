// Scheduled local notifications are not available on web.

export const notificationsSupported = false;

export function configureNotifications() {}

export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}

export function syncNotifications(): Promise<void> {
  return Promise.resolve();
}

export function useNotificationResponses() {}
