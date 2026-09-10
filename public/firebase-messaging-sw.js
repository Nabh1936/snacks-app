importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBfyvnjRkvJcTfu6cVZ7pwkb3_syYwKim8",
  authDomain: "moderndryfruits.firebaseapp.com",
  projectId: "moderndryfruits",
  storageBucket: "moderndryfruits.firebasestorage.app",
  messagingSenderId: "715523355637",
  appId: "1:715523355637:web:ed25046db1d055833ee6bc",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'New Order';
  const body = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(title, {
    body,
    icon: '/logo192.png',
    badge: '/logo192.png',
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/admin')
  );
});