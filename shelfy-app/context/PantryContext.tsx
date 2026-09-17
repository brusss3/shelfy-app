import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pantry } from '@/types';
import {
  subscribeToMyPantries,
  createPantry as createPantryApi, CreatePantryResult,
  joinPantry as joinPantryApi, JoinPantryResult,
  renamePantry as renamePantryApi,
  rotateInviteCode as rotateInviteCodeApi, RotateInviteCodeResult,
  disableInviteCode as disableInviteCodeApi,
  leavePantry as leavePantryApi,
  removeMember as removeMemberApi,
  deletePantry as deletePantryApi,
} from '@/lib/pantry';
import { useAuth } from './AuthContext';

const ACTIVE_PANTRY_KEY = 'shelfy.activePantryId';

interface PantryContextType {
  /** Case a cui l'utente appartiene (proprietario o membro). */
  pantries: Pantry[];
  loading: boolean;
  /** `null` = dispensa personale (comportamento di sempre). */
  activePantryId: string | null;
  activePantry: Pantry | null;
  setActivePantryId: (id: string | null) => void;
  createPantry: (name: string) => Promise<CreatePantryResult>;
  joinPantry: (code: string) => Promise<JoinPantryResult>;
  renamePantry: (pantryId: string, name: string) => Promise<void>;
  rotateInviteCode: (pantryId: string) => Promise<RotateInviteCodeResult>;
  disableInviteCode: (pantryId: string) => Promise<void>;
  leavePantry: (pantryId: string) => Promise<void>;
  removeMember: (pantryId: string, uid: string) => Promise<void>;
  deletePantry: (pantryId: string) => Promise<void>;
}

const stub = (): never => { throw new Error('usePantry must be used inside PantryProvider'); };
const PantryContext = createContext<PantryContextType>({
  pantries: [],
  loading: true,
  activePantryId: null,
  activePantry: null,
  setActivePantryId: stub,
  createPantry: stub,
  joinPantry: stub,
  renamePantry: stub,
  rotateInviteCode: stub,
  disableInviteCode: stub,
  leavePantry: stub,
  removeMember: stub,
  deletePantry: stub,
});

export function PantryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pantries, setPantries] = useState<Pantry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePantryId, setActivePantryIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Ripristina la dispensa attiva scelta l'ultima volta, una sola volta
  // all'avvio dell'app.
  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_PANTRY_KEY)
      .then((v) => { if (v) setActivePantryIdState(v); })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!user) {
      setPantries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToMyPantries(
      user.uid,
      (data) => { setPantries(data); setLoading(false); },
      (err) => { console.error('[PantryContext] errore:', err); setLoading(false); },
    );
    return unsub;
  }, [user]);

  // Se la casa attiva non è (più) tra quelle dell'utente — rimosso,
  // uscito, casa eliminata — si torna da soli alla dispensa personale
  // invece di restare agganciati a un id ormai morto.
  useEffect(() => {
    if (!hydrated || loading) return;
    if (activePantryId && !pantries.some((p) => p.id === activePantryId)) {
      setActivePantryIdState(null);
      AsyncStorage.removeItem(ACTIVE_PANTRY_KEY).catch(() => {});
    }
  }, [pantries, activePantryId, hydrated, loading]);

  const setActivePantryId = useCallback((id: string | null) => {
    setActivePantryIdState(id);
    if (id) AsyncStorage.setItem(ACTIVE_PANTRY_KEY, id).catch(() => {});
    else AsyncStorage.removeItem(ACTIVE_PANTRY_KEY).catch(() => {});
  }, []);

  const createPantry = useCallback(async (name: string) => {
    if (!user) throw new Error('Devi accedere');
    return createPantryApi(name, user.displayName ?? 'Utente Shelfy');
  }, [user]);

  const joinPantry = useCallback(async (code: string) => {
    if (!user) throw new Error('Devi accedere');
    return joinPantryApi(code, user.displayName ?? 'Utente Shelfy');
  }, [user]);

  const renamePantry = useCallback((pantryId: string, name: string) => renamePantryApi(pantryId, name), []);
  const rotateInviteCode = useCallback((pantryId: string) => rotateInviteCodeApi(pantryId), []);
  const disableInviteCode = useCallback((pantryId: string) => disableInviteCodeApi(pantryId), []);
  const leavePantry = useCallback((pantryId: string) => leavePantryApi(pantryId), []);
  const removeMember = useCallback((pantryId: string, uid: string) => removeMemberApi(pantryId, uid), []);
  const deletePantry = useCallback((pantryId: string) => deletePantryApi(pantryId), []);

  const activePantry = activePantryId ? (pantries.find((p) => p.id === activePantryId) ?? null) : null;

  return (
    <PantryContext.Provider
      value={{
        pantries, loading, activePantryId, activePantry, setActivePantryId,
        createPantry, joinPantry, renamePantry, rotateInviteCode, disableInviteCode,
        leavePantry, removeMember, deletePantry,
      }}
    >
      {children}
    </PantryContext.Provider>
  );
}

export const usePantry = () => useContext(PantryContext);
