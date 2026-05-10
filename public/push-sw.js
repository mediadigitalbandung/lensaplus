/**
 * Service Worker untuk web push notifications Kartawarta.
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
    payload = { title: "Kartawarta", body: event.data.text() };
  }
  const { title, body, url, icon, badge, image, tag } = payload;
  event.waitUntil(
    self.registration.showNotification(title || "Kartawarta", {
      body: body || "",
      icon: icon || "/kartawarta-icon-192.png",
      badge: badge || "/kartawarta-icon-96.png",
      image: image || undefined,
      tag: tag || undefined,
      data: { url: url || "https://kartawarta.com" },
      requireInteraction: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "https://kartawarta.com";
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
