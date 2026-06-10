/* push.js — installed-app (PWA) notifications.
 * No backend/VAPID: we register a service worker and, while the app has been
 * opened recently, fire local device notifications via the SW registration.
 * Works well on Android home-screen installs; on iOS it needs the app added to
 * the home screen (iOS 16.4+). Falls back silently where unsupported. */

export function notifSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
}

export function notifPermission() {
  return notifSupported() ? Notification.permission : 'unsupported'
}

export async function ensureNotifyPermission() {
  if (!notifSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try { return await Notification.requestPermission() } catch (e) { return 'denied' }
}

export async function showLocalNotification(title, body, { url = '/', tag } = {}) {
  if (!notifSupported() || Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const opts = { body, icon: '/icon-192.png', badge: '/icon-192.png', tag, data: { url } }
    if (reg && reg.showNotification) { await reg.showNotification(title, opts) }
    else { new Notification(title, opts) }
    return true
  } catch (e) { return false }
}
