import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  signInAnonymously,
  linkWithCredential,
  linkWithPopup,
  linkWithRedirect,
  EmailAuthProvider,
  AuthCredential,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { readGuestProducts, writeGuestProducts } from '@/lib/guest';
import { initPurchases, checkPremiumStatus } from '@/lib/purchases';
import { User, SubscriptionType } from '@/types';
import { notifyAdminsNewUser } from '@/lib/notifications';
import { subscribeToMonetizationEnabled, recordActiveNow } from '@/lib/firestore';
import { getAcquisition } from '@/lib/acquisition';

// Guida da cui è arrivato un nuovo utente (solo web), da salvare alla
// creazione del documento: vedi lib/acquisition.ts.
function acquisitionField() {
  const acquisition = getAcquisition();
  return acquisition ? { acquisition } : {};
}

function currentGuest(): FirebaseUser | null {
  const u = auth.currentUser;
  return u?.isAnonymous ? u : null;
}

// Accesso a un account esistente partendo da ospite: la dispensa dell'ospite
// si legge prima di cambiare utente (dopo non è più leggibile) e si riscrive
// sull'account. Se la copia fallisce l'accesso resta valido: perdere 10
// prodotti di prova non deve impedire di entrare.
async function switchFromGuest(signInFn: () => Promise<{ user: FirebaseUser }>): Promise<void> {
  const guest = currentGuest();
  const products = guest ? await readGuestProducts(guest.uid).catch(() => []) : [];
  const { user } = await signInFn();
  if (products.length > 0) {
    await writeGuestProducts(user.uid, products).catch((e) =>
      console.warn('[AuthContext] guest products copy failed:', e),
    );
  }
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogleWeb: () => Promise<void>;
  signInWithGoogleCredential: (idToken: string) => Promise<void>;
  /** Prova l'app senza account (accesso anonimo). Registrandosi poi da qui
   *  si tiene lo stesso uid, quindi la dispensa resta dov'è. */
  signInAsGuest: () => Promise<void>;
  logOut: () => Promise<void>;
  setPremium: (value: boolean) => Promise<void>;
  setSubscription: (info: { type: SubscriptionType; expiresAt: string | null } | null) => Promise<void>;
  setNotificationsEnabled: (value: boolean) => Promise<void>;
  /** False finché l'admin non mette in vendita i piani: nasconde paywall e
   *  inviti all'acquisto, lasciando attivi i limiti del piano base. */
  monetizationEnabled: boolean;
  updateAdminNotifSettings: (prefs: { adminNotifNewUsers?: boolean; adminNotifFeedback?: boolean }) => Promise<void>;
}

const stub = (): never => { throw new Error('useAuth must be used inside AuthProvider'); };
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: stub,
  signUp: stub,
  resetPassword: stub,
  signInWithGoogleWeb: stub,
  signInWithGoogleCredential: stub,
  signInAsGuest: stub,
  logOut: stub,
  setPremium: stub,
  setSubscription: stub,
  setNotificationsEnabled: stub,
  monetizationEnabled: false,
  updateAdminNotifSettings: stub,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Stato premium secondo RevenueCat, fonte di verità finché il webhook non
  // allinea Firestore. Sopravvive agli snapshot del documento utente.
  const rcPremiumRef = useRef(false);
  const [monetizationEnabled, setMonetizationEnabled] = useState(false);

  useEffect(() => subscribeToMonetizationEnabled(setMonetizationEnabled, () => {}), []);

  useEffect(() => {
    // Completa un eventuale login via redirect (fallback PWA). Su successo
    // onAuthStateChanged scatterà da solo; qui logghiamo solo eventuali errori.
    // getRedirectResult esiste SOLO nel build web di Firebase: su nativo
    // (iOS/Android) è undefined e chiamarlo farebbe crashare l'app all'avvio.
    // Se il redirect era il collegamento Google di un ospite, va completata
    // la promozione ad account (vedi upgradeGuest).
    if (Platform.OS === 'web' && typeof getRedirectResult === 'function') {
      getRedirectResult(auth)
        .then((res) => {
          if (res?.operationType === 'link') return upgradeGuest(res.user);
        })
        .catch((e) =>
          console.warn('[AuthContext] getRedirectResult error:', e?.code, e?.message),
        );
    }

    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubFirestore?.();
      unsubFirestore = null;

      console.log('[AuthContext] onAuthStateChanged uid:', firebaseUser?.uid ?? 'null');

      if (firebaseUser) {
        // Gli ospiti non comprano: niente cliente RevenueCat per un uid
        // anonimo che potrebbe sparire tra 30 giorni (vedi upgrade più sotto).
        if (!firebaseUser.isAnonymous) {
          initPurchases(firebaseUser.uid);
          // In un ref, non in una const catturata dalla closure: dopo un acquisto
          // va aggiornato, altrimenti il primo snapshot del documento utente
          // ricalcolerebbe isPremium con il valore letto al login (false) e
          // spegnerebbe il premium appena acquistato.
          rcPremiumRef.current = await checkPremiumStatus();
        } else {
          rcPremiumRef.current = false;
        }

        // Ascolta il documento utente in tempo reale — aggiorna isPremium senza rilogin
        unsubFirestore = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            console.log('[AuthContext] user doc snapshot:', JSON.stringify(snap.data()));

            // Auto-provisioning: se il documento non esiste (es. primo accesso
            // con Google, o creazione fallita in fase di registrazione) lo crea
            // con i valori di default. Lo snapshot scatterà di nuovo con i dati.
            if (!snap.exists()) {
              setDoc(doc(db, 'users', firebaseUser.uid), {
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                isPremium: false,
                notificationsEnabled: true,
                createdAt: new Date().toISOString(),
                ...(firebaseUser.isAnonymous ? { isGuest: true } : {}),
                ...acquisitionField(),
              }, { merge: true }).catch((e) => console.warn('[AuthContext] auto-provision failed:', e));

              // Un ospite non è ancora un utente: l'avviso parte quando si
              // registra (upgradeGuestDoc).
              if (!firebaseUser.isAnonymous) {
                notifyAdminsNewUser({
                  email: firebaseUser.email ?? '',
                  displayName: firebaseUser.displayName,
                }).catch((e) => console.warn('[AuthContext] notifyAdminsNewUser failed:', e));
              }
            }

            const data = snap.data();

            // Un utilizzo al giorno basta per misurare chi torna dopo la prima
            // settimana. Il confronto sulla data evita il ciclo: la scrittura
            // fa ripartire lo snapshot, che trova già la data di oggi.
            if (snap.exists() && (data?.lastActiveAt ?? '').slice(0, 10) !== new Date().toISOString().slice(0, 10)) {
              recordActiveNow(firebaseUser.uid).catch(() => {});
            }

            const firestorePremium: boolean = data?.isPremium ?? false;
            const isPremium = firestorePremium || rcPremiumRef.current;
            const isAdmin: boolean = data?.isAdmin ?? false;
            const subscriptionType = data?.subscriptionType ?? null;
            const subscriptionExpiresAt = data?.subscriptionExpiresAt ?? null;
            const notificationsEnabled: boolean = data?.notificationsEnabled ?? true;
            const pushToken: string | undefined = data?.pushToken ?? undefined;
            const adminNotifNewUsers: boolean = data?.adminNotifNewUsers ?? true;
            const adminNotifFeedback: boolean = data?.adminNotifFeedback ?? true;
            // Blocco AI per singolo utente, impostato solo dall'admin.
            const aiDisabled: boolean = data?.aiDisabled ?? false;

            // `isPremium` su Firestore lo scrive SOLO il webhook RevenueCat
            // (Cloud Function, Admin SDK): le regole lo proteggono, e un
            // tentativo dal client verrebbe applicato in locale e poi rifiutato
            // dal server, facendo rimbalzare lo snapshot all'infinito.
            // Qui RevenueCat serve solo a sbloccare subito la sessione
            // corrente, in attesa che il webhook allinei il documento.

            // Da auth.currentUser e non da firebaseUser: dopo il collegamento
            // di un account l'utente resta lo stesso (onAuthStateChanged non
            // riparte), ma isAnonymous diventa false. Il campo del documento
            // (scritto da upgradeGuest) copre il caso in cui non sia ancora
            // aggiornato.
            const anonymous = auth.currentUser?.uid === firebaseUser.uid
              ? auth.currentUser.isAnonymous
              : firebaseUser.isAnonymous;
            const isGuest = anonymous && data?.isGuest !== false;

            setUser({
              uid: firebaseUser.uid,
              email: auth.currentUser?.email ?? firebaseUser.email,
              displayName: firebaseUser.displayName,
              isPremium,
              isAdmin,
              subscriptionType,
              subscriptionExpiresAt,
              notificationsEnabled,
              pushToken,
              adminNotifNewUsers,
              adminNotifFeedback,
              aiDisabled,
              isGuest,
            });
            setLoading(false);
          },
          (err) => {
            console.log('[AuthContext] onSnapshot ERROR:', err.code, err.message);
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              isPremium: rcPremiumRef.current,
              isGuest: firebaseUser.isAnonymous,
            });
            setLoading(false);
          },
        );
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      unsubFirestore?.();
    };
  }, []);

  // Ospite appena diventato account (stesso uid). Il token va rinnovato
  // subito: le regole e le Cloud Function leggono il provider dal token, e
  // quello vecchio dice ancora "anonymous" per un'ora.
  const upgradeGuest = async (fbUser: FirebaseUser, name?: string) => {
    await fbUser.getIdToken(true);
    const email = fbUser.email;
    const displayName = name ?? fbUser.displayName;
    try {
      await setDoc(doc(db, 'users', fbUser.uid), {
        email,
        displayName,
        isGuest: false,
        upgradedAt: new Date().toISOString(),
      }, { merge: true });
      notifyAdminsNewUser({ email: email ?? '', displayName }).catch((e) =>
        console.warn('[AuthContext] notifyAdminsNewUser failed:', e),
      );
    } catch (err) {
      console.warn('[AuthContext] guest upgrade doc failed:', err);
    }
    initPurchases(fbUser.uid);
    setUser((prev) => prev ? { ...prev, email, displayName, isGuest: false } : prev);
  };

  // Da ospite, un account che esiste già non si può collegare (ha un altro
  // uid): si entra in quello, portandosi dietro i prodotti di prova.
  const linkOrSwitch = async (credential: AuthCredential) => {
    const guest = currentGuest();
    if (!guest) {
      await signInWithCredential(auth, credential);
      return;
    }
    try {
      const res = await linkWithCredential(guest, credential);
      await upgradeGuest(res.user);
    } catch (e: any) {
      if (e?.code !== 'auth/credential-already-in-use' && e?.code !== 'auth/email-already-in-use') throw e;
      const existing = GoogleAuthProvider.credentialFromError(e) ?? credential;
      await switchFromGuest(() => signInWithCredential(auth, existing));
    }
  };

  const signInAsGuest = async () => {
    await signInAnonymously(auth);
  };

  const signIn = async (email: string, password: string) => {
    await switchFromGuest(() => signInWithEmailAndPassword(auth, email, password));
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const signUp = async (email: string, password: string, name: string) => {
    // Da ospite la registrazione collega email e password all'utente anonimo:
    // stesso uid, la dispensa di prova resta dov'è.
    const guest = currentGuest();
    if (guest) {
      const linked = await linkWithCredential(guest, EmailAuthProvider.credential(email, password));
      try {
        await updateProfile(linked.user, { displayName: name });
      } catch (err) {
        console.warn('[AuthContext] updateProfile failed:', err);
      }
      await upgradeGuest(linked.user, name);
      return;
    }

    // L'account viene creato qui. Se la scrittura del profilo su Firestore
    // fallisce (rete/permessi), NON deve far fallire la registrazione: l'utente
    // è comunque autenticato e il documento può essere creato in seguito.
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    try {
      await updateProfile(cred.user, { displayName: name });
    } catch (err) {
      console.warn('[AuthContext] updateProfile failed:', err);
    }

    try {
      await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        displayName: name,
        isPremium: false,
        notificationsEnabled: true,
        createdAt: new Date().toISOString(),
        ...acquisitionField(),
      });
      notifyAdminsNewUser({ email, displayName: name }).catch((e) =>
        console.warn('[AuthContext] notifyAdminsNewUser failed:', e),
      );
    } catch (err) {
      console.warn('[AuthContext] user doc creation failed:', err);
    }

    setUser({
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: name,
      isPremium: false,
      notificationsEnabled: true,
    });
  };

  // Web: popup Google gestito da Firebase. Il documento utente viene creato
  // automaticamente dall'auto-provisioning nello snapshot.
  const signInWithGoogleWeb = async () => {
    const provider = new GoogleAuthProvider();
    // Il popup funziona nei normali tab (desktop e Safari iOS), perché aperto
    // da un gesto utente. Su Safari iOS il redirect spesso NON si completa
    // (storage cross-domain bloccato), quindi popup è la via preferita.
    // Il redirect resta solo come fallback (es. PWA installata in standalone,
    // dove non si può aprire un popup).
    // Da ospite si collega Google all'utente anonimo invece di entrare.
    const guest = currentGuest();
    try {
      if (guest) {
        const res = await linkWithPopup(guest, provider);
        await upgradeGuest(res.user);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (e: any) {
      if (
        e?.code === 'auth/popup-blocked' ||
        e?.code === 'auth/cancelled-popup-request' ||
        e?.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        if (guest) await linkWithRedirect(guest, provider);
        else await signInWithRedirect(auth, provider);
        return;
      }
      // Account Google già registrato: si entra in quello (vedi linkOrSwitch).
      if (guest && e?.code === 'auth/credential-already-in-use') {
        const existing = GoogleAuthProvider.credentialFromError(e);
        if (existing) {
          await switchFromGuest(() => signInWithCredential(auth, existing));
          return;
        }
      }
      throw e;
    }
  };

  // iOS/Android: idToken ottenuto via expo-auth-session → credenziale Firebase.
  const signInWithGoogleCredential = async (idToken: string) => {
    await linkOrSwitch(GoogleAuthProvider.credential(idToken));
  };

  const logOut = async () => {
    await signOut(auth);
  };

  // Stato abbonamento: aggiorna SOLO la sessione locale, così la UI reagisce
  // subito dopo un acquisto. La verità su Firestore la scrive il webhook
  // RevenueCat lato server — le regole vietano al client di toccare
  // isPremium/subscription*, e provarci fa rimbalzare lo snapshot.
  const setPremium = async (value: boolean) => {
    rcPremiumRef.current = value;
    setUser((prev) => prev ? { ...prev, isPremium: value } : null);
  };

  const setSubscription = async (info: { type: SubscriptionType; expiresAt: string | null } | null) => {
    const patch = info
      ? { isPremium: true, subscriptionType: info.type, subscriptionExpiresAt: info.expiresAt }
      : { subscriptionType: null, subscriptionExpiresAt: null };
    if (info) rcPremiumRef.current = true;
    setUser((prev) => prev ? { ...prev, ...patch } : null);
  };

  const setNotificationsEnabled = async (value: boolean) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { notificationsEnabled: value }, { merge: true });
    } catch {}
    setUser((prev) => prev ? { ...prev, notificationsEnabled: value } : null);
  };

  const updateAdminNotifSettings = async (prefs: { adminNotifNewUsers?: boolean; adminNotifFeedback?: boolean }) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), prefs, { merge: true });
    } catch {}
    setUser((prev) => prev ? { ...prev, ...prefs } : null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, resetPassword, signInWithGoogleWeb, signInWithGoogleCredential, signInAsGuest, logOut, setPremium, setSubscription, setNotificationsEnabled, updateAdminNotifSettings, monetizationEnabled }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
