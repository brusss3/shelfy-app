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

### 2e. Ricetta AI giornaliera (Cloud Functions + Groq)

La chiave Groq **non** va mai nel codice dell'app: sarebbe leggibile nel bundle
web e chiunque potrebbe consumare il credito. Vive solo in Secret Manager, letta
dalla Cloud Function `generateDailyRecipe`.

Richiede il piano **Blaze** sul progetto Firebase (il free tier delle Functions
resta incluso; con 1 generazione al giorno per utente la spesa è ~0).

```bash
cd functions && npm install && cd ..

# Salva la chiave (la trovi su console.groq.com → API Keys)
firebase functions:secrets:set GROQ_API_KEY

firebase deploy --only functions
```

Per provare in locale senza deployare, metti la chiave in `functions/.env.local`
(`GROQ_API_KEY=...`, già ignorato da git) e avvia:

```bash
firebase emulators:start --only functions,firestore
```

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

## 5. Monetizzazione con RevenueCat (Premium)

### 5a. Installa il pacchetto

```bash
npx expo install react-native-purchases
```

> ⚠️ RevenueCat usa moduli nativi — **non funziona in Expo Go**.
> Devi creare un development build con `expo-dev-client` oppure fare una build EAS.

### 5b. Crea account e app su RevenueCat

1. Registrati su [app.revenuecat.com](https://app.revenuecat.com)
2. Crea un nuovo **Project** (es. "Shelfy")
3. Aggiungi due app: una **iOS** e una **Android**
4. Per ogni app, copia la **Public SDK key** (inizia con `appl_` per iOS, `goog_` per Android)
5. Incollale in `lib/purchases.ts`:
   ```ts
   export const RC_IOS_KEY = 'appl_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
   export const RC_ANDROID_KEY = 'goog_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
   ```

### 5c. Crea i prodotti sullo store

**App Store Connect (iOS)**
1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → La tua app → Abbonamenti
2. Crea un gruppo di abbonamenti (es. "Shelfy Premium")
3. Aggiungi prodotti: `shelfy_premium_monthly` (mensile) e `shelfy_premium_annual` (annuale)

**Google Play Console (Android)**
1. [play.google.com/console](https://play.google.com/console) → La tua app → Monetizza → Abbonamenti
2. Crea gli stessi prodotti con gli stessi ID

### 5d. Collega i prodotti a RevenueCat

1. RevenueCat → Products → **Import** (importa automaticamente da App Store / Play Store)
2. RevenueCat → Entitlements → Crea entitlement con identifier `premium`
3. Collega entrambi i prodotti all'entitlement `premium`
4. RevenueCat → Offerings → Crea un offering `default` con i due package (Annual + Monthly)

### 5e. Test con Sandbox

- **iOS**: Usa un Apple Sandbox Tester (App Store Connect → Users → Sandbox Testers)
- **Android**: Pubblica una Internal Testing track su Play Console, aggiungi il tuo account come tester

### 5f. Development build

```bash
# Installa expo-dev-client
npx expo install expo-dev-client

# Build Android (usa EAS o locale)
npx expo run:android

# Build iOS (richiede macOS + Xcode)
npx expo run:ios
```

RevenueCat gestisce automaticamente:
- ✅ Abbonamenti iOS (App Store)
- ✅ Abbonamenti Android (Play Store)
- ✅ Rinnovi automatici e scadenze
- ✅ Sincronizzazione cross-platform via `appUserID`

## 6. Struttura del database Firestore

```
users/
  {userId}/
    products/
      {productId}/
        name: string
        brand: string
        qty: string     (formato confezione, es. "1 L")
        count: number   (unità identiche con la stessa scadenza)
        zone: 'frigo' | 'freezer' | 'dispensa'
        category: string
        expiry: string  (YYYY-MM-DD)
        added: string   (YYYY-MM-DD)
        openedAt?: string / openExpiry?: string
        barcode: string
        tint: string    (hex color)
        cal: number
        userId: string
    savedRecipes/{recipeId}   ricette community messe da parte
    myRecipes/{recipeId}      ricette personali (source: 'ai' | 'manual')
    aiUsage/{YYYY-MM-DD}      credito AI del giorno (scrive solo la Function)

communityRecipes/{recipeId}
  ratings/{userId}            un voto per utente (1-5)
recipeRequests/{requestId}
  proposals/{proposalId}      ricette proposte in risposta
feedback/{docId}              status: 'nuovo' | 'letto' | 'risolto'
```

## 7. Scanner barcode

Lo scanner usa la fotocamera nativa del dispositivo con `expo-camera` e consulta l'API gratuita **Open Food Facts** per i dati del prodotto.

Se il barcode non è nel database, l'utente può inserire i dati manualmente.
