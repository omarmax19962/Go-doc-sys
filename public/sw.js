/* Go Doc service worker.
 * Deliberately has NO fetch/caching handler — every deploy ships fresh assets,
 * so we never want to serve a stale build. Its jobs: exist (so the app is
 * installable as a PWA), render push notifications, and handle their buttons.
 *
 * Urgent doctor alerts (see docs/alerts-and-coverage.md) arrive as a push with
 *   { title, body, tag, renotify, requireInteraction, vibrate, actions, data:{ url, alertId, ackUrl } }
 * - same `tag` + `renotify` => every re-ping buzzes again instead of silently replacing
 * - `requireInteraction` => stays on screen until the doctor deals with it (desktop/Android)
 * - "On it" button => acknowledges from the lock screen without opening the app */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

const ackAlert = (ackUrl) => {
  if (!ackUrl) return Promise.resolve()
  return fetch(ackUrl, { method: 'POST' }).catch(() => {}) // best effort — the in-app takeover is the fallback
}

// Focus an open window (or open one) when a notification (or its Open button) is tapped.
self.addEventListener('notificationclick', (event) => {
  const n = event.notification
  const data = n.data || {}
  n.close()
  if (event.action === 'ack') { event.waitUntil(ackAlert(data.ackUrl)); return }
  const url = data.url || '/'
  event.waitUntil((async () => {
    // Opening the app to deal with it counts as "on it" — stops the buzzing while they work.
    if (data.alertId) await ackAlert(data.ackUrl)
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) { try { await c.navigate(url) } catch (e) { /* ignore */ } return c.focus() }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = { body: event.data && event.data.text() } }
  const title = data.title || 'Go Doc'
  const opts = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    renotify: !!data.renotify && !!data.tag, // renotify without a tag throws
    requireInteraction: !!data.requireInteraction,
    vibrate: data.vibrate,
    actions: data.actions,
    data: { ...(data.data || {}), url: (data.data && data.data.url) || data.url || '/' },
  }
  event.waitUntil((async () => {
    await self.registration.showNotification(title, opts)
    // Tell any open window so it can raise the in-app takeover immediately.
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    all.forEach((c) => c.postMessage({ type: 'godoc-alert', alertId: opts.data.alertId || null }))
  })())
})
