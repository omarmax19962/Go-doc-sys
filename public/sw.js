/* Go Doc service worker.
 * Deliberately has NO fetch/caching handler — every deploy ships fresh assets,
 * so we never want to serve a stale build. Its only job is to exist (so the app
 * is installable as a PWA) and to handle notification clicks / push events. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Focus an open window (or open one) when a notification is tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) { try { await c.navigate(url) } catch (e) { /* ignore */ } return c.focus() }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})

// If real Web Push (VAPID) is added later, this renders the payload.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = { body: event.data && event.data.text() } }
  const title = data.title || 'Go Doc'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  }))
})
