/**
 * Service Worker untuk web push notifications Lensaplus.
 * Listen 'push' event, render notification, handle 'notificationclick' to open URL.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Lensaplus", body: event.data.text() };
  }
  const { title, body, url, icon, badge, image, tag } = payload;
  event.waitUntil(
    self.registration.showNotification(title || "Lensaplus", {
      body: body || "",
      icon: icon || "/lensaplus-icon-192.png",
      badge: badge || "/lensaplus-icon-96.png",
      image: image || undefined,
      tag: tag || undefined,
      data: { url: url || "https://lensaplus.com" },
      requireInteraction: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "https://lensaplus.com";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing tab if one is open on this URL
        for (const client of clients) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
