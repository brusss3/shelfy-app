import React, { createContext, useContext, useEffect, useState } from 'react';
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
} from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
// import { initPurchases, checkPremiumStatus } from '@/lib/purchases'; // RC disabilitato
import { User, SubscriptionType } from '@/types';
import { notifyAdminsNewUser } from '@/lib/notifications';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogleWeb: () => Promise<void>;
  signInWithGoogleCredential: (idToken: string) => Promise<void>;
  logOut: () => Promise<void>;
  setPremium: (value: boolean) => Promise<void>;
  setSubscription: (info: { type: SubscriptionType; expiresAt: string | null } | null) => Promise<void>;
  setNotificationsEnabled: (value: boolean) => Promise<void>;
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
  logOut: stub,
  setPremium: stub,
  setSubscription: stub,
  setNotificationsEnabled: stub,
  updateAdminNotifSettings: stub,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Completa un eventuale login via redirect (fallback PWA). Su successo
    // onAuthStateChanged scatterà da solo; qui logghiamo solo eventuali errori.
    // getRedirectResult esiste SOLO nel build web di Firebase: su nativo
    // (iOS/Android) è undefined e chiamarlo farebbe crashare l'app all'avvio.
    if (Platform.OS === 'web' && typeof getRedirectResult === 'function') {
      getRedirectResult(auth).catch((e) =>
        console.warn('[AuthContext] getRedirectResult error:', e?.code, e?.message),
      );
    }

    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubFirestore?.();
      unsubFirestore = null;

      console.log('[AuthContext] onAuthStateChanged uid:', firebaseUser?.uid ?? 'null');

      if (firebaseUser) {
        // initPurchases(firebaseUser.uid); // RC disabilitato
        const rcPremium = false; // checkPremiumStatus() disabilitato

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
              }, { merge: true }).catch((e) => console.warn('[AuthContext] auto-provision failed:', e));

              notifyAdminsNewUser({
                email: firebaseUser.email ?? '',
                displayName: firebaseUser.displayName,
              }).catch((e) => console.warn('[AuthContext] notifyAdminsNewUser failed:', e));
            }

            const data = snap.data();
            const firestorePremium: boolean = data?.isPremium ?? false;
            const isPremium = firestorePremium || rcPremium;
            const isAdmin: boolean = data?.isAdmin ?? false;
            const subscriptionType = data?.subscriptionType ?? null;
            const subscriptionExpiresAt = data?.subscriptionExpiresAt ?? null;
            const notificationsEnabled: boolean = data?.notificationsEnabled ?? true;
            const pushToken: string | undefined = data?.pushToken ?? undefined;
            const adminNotifNewUsers: boolean = data?.adminNotifNewUsers ?? true;
            const adminNotifFeedback: boolean = data?.adminNotifFeedback ?? true;

            // RC sync disabilitato: if (rcPremium && !firestorePremium) { ... }

            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              isPremium,
              isAdmin,
              subscriptionType,
              subscriptionExpiresAt,
              notificationsEnabled,
              pushToken,
              adminNotifNewUsers,
              adminNotifFeedback,
            });
            setLoading(false);
          },
          (err) => {
            console.log('[AuthContext] onSnapshot ERROR:', err.code, err.message);
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              isPremium: rcPremium,
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

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const signUp = async (email: string, password: string, name: string) => {
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
    try {
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      if (
        e?.code === 'auth/popup-blocked' ||
        e?.code === 'auth/cancelled-popup-request' ||
        e?.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw e;
    }
  };

  // iOS/Android: idToken ottenuto via expo-auth-session → credenziale Firebase.
  const signInWithGoogleCredential = async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const setPremium = async (value: boolean) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { isPremium: value }, { merge: true });
    } catch {}
    setUser((prev) => prev ? { ...prev, isPremium: value } : null);
  };

  const setSubscription = async (info: { type: SubscriptionType; expiresAt: string | null } | null) => {
    if (!user) return;
    const patch = info
      ? { isPremium: true, subscriptionType: info.type, subscriptionExpiresAt: info.expiresAt }
      : { subscriptionType: null, subscriptionExpiresAt: null };
    try {
      await setDoc(doc(db, 'users', user.uid), patch, { merge: true });
    } catch {}
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
    <AuthContext.Provider value={{ user, loading, signIn, signUp, resetPassword, signInWithGoogleWeb, signInWithGoogleCredential, logOut, setPremium, setSubscription, setNotificationsEnabled, updateAdminNotifSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
