importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA5vKbYnVOWyIfcLdwZ62UrpUSAyxeagJk",
  authDomain: "shelfy-632e0.firebaseapp.com",
  projectId: "shelfy-632e0",
  storageBucket: "shelfy-632e0.firebasestorage.app",
  messagingSenderId: "288975536587",
  appId: "1:288975536587:web:8a9baeb3a53db632af364e",
});

const messaging = firebase.messaging();

// Riceve i push mentre la PWA è chiusa/in background e mostra la notifica di
// sistema. Coi messaggi in foreground se ne occupa invece onMessage() nel
// codice app (lib/webPush.ts), perché qui il tab non è visibile all'utente.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? payload.data?.title ?? 'Shelfy';
  const body = payload.notification?.body ?? payload.data?.body ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data ?? {},
  });
});
