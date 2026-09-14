import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyA5vKbYnVOWyIfcLdwZ62UrpUSAyxeagJk",
  authDomain: "shelfy-632e0.firebaseapp.com",
  projectId: "shelfy-632e0",
  storageBucket: "shelfy-632e0.firebasestorage.app",
  messagingSenderId: "288975536587",
  appId: "1:288975536587:web:8a9baeb3a53db632af364e",
  measurementId: "G-7F5BDPNM29"
};

const alreadyInitialized = getApps().length > 0;
const app = alreadyInitialized ? getApp() : initializeApp(firebaseConfig);

function buildAuth() {
  if (alreadyInitialized || Platform.OS === 'web') return getAuth(app);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getReactNativePersistence } = require('firebase/auth');
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export const auth = buildAuth();
export const db = getFirestore(app);
// Stessa region delle Cloud Functions (vicina a Firestore eur3).
export const functions = getFunctions(app, 'europe-west1');
export default app;
