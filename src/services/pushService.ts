// Push Notification Service
// จัดการการขอสิทธิ์, การ subscribe และการแจ้งเตือนภายในแอป

const VAPID_PUBLIC_KEY = 'BJ9ux0HOM7ynfEnwkxkrcQuUZ6e7kKYLcEKV07Cwgz1fAH5tSxFGoYnlW1FDVSrStAueMd6JSWLQ31c_Jx90vGw';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Register Service Worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('✅ Service Worker registered:', registration.scope);
    return registration;
  } catch (err) {
    console.error('❌ Service Worker registration failed:', err);
    return null;
  }
}

// ขอสิทธิ์ notification และ subscribe กับ Push server
export async function subscribeToPush(): Promise<PushSubscription | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return null;
    }

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // ส่ง subscription ไปเก็บที่ Vercel API
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    console.log('✅ Push subscription successful');
    return subscription;
  } catch (err) {
    console.error('❌ Push subscription failed:', err);
    return null;
  }
}

// เช็คสถานะสิทธิ์ปัจจุบัน
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

// ยกเลิก subscription
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      // แจ้ง server ให้ลบออก
      await fetch('/api/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Unsubscribe failed:', err);
    return false;
  }
}

// ทดสอบ notification (local - ไม่ผ่าน server)
export async function sendTestNotification(title: string, body: string): Promise<void> {
  if (Notification.permission !== 'granted') {
    alert('กรุณาอนุญาตการแจ้งเตือนก่อนครับ');
    return;
  }

  // ใช้ Service Worker เพื่อแสดง notification (รองรับ iOS)
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    body,
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [200, 100, 200],
  } as NotificationOptions);
}
