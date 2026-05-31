import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
// import { initPurchases, checkPremiumStatus } from '@/lib/purchases'; // RC disabilitato
import { User, SubscriptionType } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  logOut: () => Promise<void>;
  setPremium: (value: boolean) => Promise<void>;
  setSubscription: (info: { type: SubscriptionType; expiresAt: string | null } | null) => Promise<void>;
  setNotificationsEnabled: (value: boolean) => Promise<void>;
}

const stub = (): never => { throw new Error('useAuth must be used inside AuthProvider'); };
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: stub,
  signUp: stub,
  logOut: stub,
  setPremium: stub,
  setSubscription: stub,
  setNotificationsEnabled: stub,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
            const data = snap.data();
            const firestorePremium: boolean = data?.isPremium ?? false;
            const isPremium = firestorePremium || rcPremium;
            const isAdmin: boolean = data?.isAdmin ?? false;
            const subscriptionType = data?.subscriptionType ?? null;
            const subscriptionExpiresAt = data?.subscriptionExpiresAt ?? null;
            const notificationsEnabled: boolean = data?.notificationsEnabled ?? true;

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

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, logOut, setPremium, setSubscription, setNotificationsEnabled }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
