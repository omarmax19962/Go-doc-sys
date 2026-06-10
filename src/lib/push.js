/* push.js — browser Web Push (VAPID) + local fallback notifications.
 * subscribeToPush() registers a real Web Push subscription so the recipient gets
 * notifications even when the GoDoc site is fully closed (Chrome/Android, and iOS
 * 16.4+ when added to the home screen). showLocalNotification() is the in-app
 * fallback used while the tab is open. Falls back silently where unsupported. */
import { supabase } from './supabase'

// Public VAPID key — safe to ship in the frontend; the private key lives only in
// the Supabase app_secrets table, read by the send-push edge function.
export const VAPID_PUBLIC_KEY =
  'BIslGbOLTSG_67icgRHrxPXyCDn6OtCgh1jOIxrPZw7xqUxn7mvh35npccOJzsCB3j5fXjubx3_6yuvQY3g7xf0'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/* Register a real Web Push subscription and save it (with the recipient's
 * identity) so the edge function can target the right person. role: 'admin' |
 * 'doctor'; identity: doctor name (ignored for admin). Idempotent. */
export async function subscribeToPush({ role = 'admin', identity = null } = {}) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }
  if (Notification.permission !== 'granted') return { ok: false, reason: 'permission' }
  try {
    const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready)
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
    const json = sub.toJSON()
    const row = {
      role,
      identity: role === 'doctor' ? identity : null,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' })
    if (error) { console.warn('[push] save subscription failed', error); return { ok: false, reason: 'save' } }
    return { ok: true }
  } catch (e) {
    console.warn('[push] subscribe failed', e)
    return { ok: false, reason: 'error' }
  }
}

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
