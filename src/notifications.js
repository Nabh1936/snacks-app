import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import app, { db } from './firebase';

// Paste your VAPID key here — get it from:
// Firebase Console → Project Settings → Cloud Messaging tab → Web Push certificates
const VAPID_KEY = 'BIUd-_-x2pfCCqruRo7uknvVjUGtd2YzUCzev898pY10k3lq2dtSLBIXm42NdtE-xyE3FYcJNj__UQdYrYe1SCw';

export async function enableOrderNotifications(adminPhone) {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return { ok: false, reason: 'Notifications are not supported on this browser' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'Permission was not granted' };
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { ok: false, reason: 'Could not get a device token' };
    }

    await setDoc(doc(db, 'adminTokens', adminPhone), {
      token,
      updatedAt: Date.now(),
    });

    return { ok: true };
  } catch (error) {
    console.error('Notification setup error:', error);
    return { ok: false, reason: error.message };
  }
}