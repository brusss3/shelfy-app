# Shelfy — Setup Guide

## Prerequisiti

```bash
node >= 18
npm install -g expo-cli eas-cli
```

## 1. Installa le dipendenze

```bash
cd shelfy-app
npm install
```

## 2. Configura Firebase

### 2a. Crea il progetto Firebase (se non l'hai già)
1. Vai su [https://console.firebase.google.com](https://console.firebase.google.com)
2. Crea un nuovo progetto
3. Abilita **Authentication** → Email/Password
4. Crea un database **Firestore** in modalità produzione
5. Aggiungi un'app **Web** al progetto

### 2b. Inserisci la tua config Firebase
Apri `lib/firebase.ts` e sostituisci i valori:

```ts
const firebaseConfig = {
  apiKey: 'LA_TUA_API_KEY',
  authDomain: 'il-tuo-progetto.firebaseapp.com',
  projectId: 'il-tuo-progetto',
  storageBucket: 'il-tuo-progetto.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123:web:abc',
};
```

### 2c. Deploy le regole Firestore
```bash
npm install -g firebase-tools
firebase login
firebase init firestore  # seleziona il tuo progetto
firebase deploy --only firestore:rules
```

### 2d. Per notifiche push su Android
1. Scarica `google-services.json` da Firebase Console → Impostazioni progetto → Android
2. Mettilo nella root di `shelfy-app/`

## 3. Avvia in sviluppo

```bash
# Web (browser)
npx expo start --web

# iOS (richiede macOS + Xcode)
npx expo start --ios

# Android (richiede Android Studio o dispositivo fisico)
npx expo start --android
```

Scansiona il QR code con l'app **Expo Go** su iOS/Android per testare subito.

## 4. Build per produzione

### Setup EAS (Expo Application Services)
```bash
eas login
eas build:configure
```

### Build Android (APK / AAB)
```bash
eas build --platform android --profile production
```

### Build iOS (IPA)
```bash
eas build --platform ios --profile production
```

### Build Web (PWA)
```bash
npx expo export --platform web
# Output in dist/ — carica su Netlify, Vercel, Firebase Hosting...
```

## 5. Monetizzazione con RevenueCat (Premium/Base)

Per aggiungere abbonamenti premium:

```bash
npm install react-native-purchases
```

1. Crea account su [https://app.revenuecat.com](https://app.revenuecat.com)
2. Configura i prodotti su App Store Connect e Google Play Console
3. Aggiungi in `app/_layout.tsx`:

```ts
import Purchases from 'react-native-purchases';

// In useEffect:
Purchases.configure({ apiKey: 'YOUR_REVENUECAT_API_KEY' });
```

RevenueCat gestisce automaticamente:
- ✅ Abbonamenti iOS (App Store)
- ✅ Abbonamenti Android (Play Store)  
- ✅ Integrazione Stripe per web
- ✅ Sincronizzazione cross-platform

## 6. Struttura del database Firestore

```
users/
  {userId}/
    products/
      {productId}/
        name: string
        brand: string
        qty: string
        zone: 'frigo' | 'freezer' | 'dispensa'
        category: string
        expiry: string  (YYYY-MM-DD)
        added: string   (YYYY-MM-DD)
        barcode: string
        tint: string    (hex color)
        cal: number
        userId: string
```

## 7. Scanner barcode

Lo scanner usa la fotocamera nativa del dispositivo con `expo-camera` e consulta l'API gratuita **Open Food Facts** per i dati del prodotto.

Se il barcode non è nel database, l'utente può inserire i dati manualmente.
