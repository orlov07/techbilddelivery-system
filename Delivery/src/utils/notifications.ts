/**
 * Requests browser notification permission (must be called from a user gesture).
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/** Returns the current notification permission state. */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Shows a native notification via the Service Worker (works in background on Android,
 * and on iOS 16.4+ when the PWA is installed).
 * Falls back to the Notification constructor if SW is unavailable.
 */
export async function pushNotification(
  title: string,
  body: string,
  tag = 'tb-notify'
): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: '/icon-512.png',
        badge: '/icon-192.png',
        tag,
        vibrate: [200, 100, 200],
      } as NotificationOptions);
    } else {
      new Notification(title, { body, icon: '/icon-512.png' });
    }
  } catch {
    // Some browsers block notifications in certain contexts — ignore silently.
  }
}
