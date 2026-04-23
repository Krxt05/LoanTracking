// Service Worker for Push Notifications
// ไฟล์นี้จะถูก register โดย pushService.ts

const CACHE_NAME = 'loantrack-v1';

// Handle push events จาก Vercel API
self.addEventListener('push', (event) => {
  let data = { title: 'LoanTrack', body: 'มีการแจ้งเตือนใหม่', icon: '/icon.png' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon.png',
    badge: '/icon.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'เปิดแอป' },
      { action: 'close', title: 'ปิด' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // ถ้าแอปเปิดอยู่แล้ว ให้ focus
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // ถ้าไม่มี ให้เปิดหน้าต่างใหม่
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Install & Activate
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
