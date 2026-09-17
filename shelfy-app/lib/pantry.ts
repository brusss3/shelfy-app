import {
  collection, doc, onSnapshot, query, where, updateDoc, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { Pantry, PantryInvite, PantryMember, PantryRole } from '@/types';

function tsToIso(ts: unknown): string | null {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === 'string') return ts;
  return null;
}

function pantryFromDoc(id: string, data: Record<string, unknown>): Pantry {
  const rawMembers = (data.members as Record<string, Record<string, unknown>>) ?? {};
  const members: Record<string, PantryMember> = {};
  for (const [uid, m] of Object.entries(rawMembers)) {
    members[uid] = {
      name: (m?.name as string) ?? '',
      role: (m?.role as PantryRole) === 'owner' ? 'owner' : 'member',
      joinedAt: tsToIso(m?.joinedAt) ?? '',
    };
  }
  return {
    id,
    name: (data.name as string) ?? '',
    ownerId: (data.ownerId as string) ?? '',
    memberIds: (data.memberIds as string[]) ?? [],
    members,
    createdAt: tsToIso(data.createdAt) ?? '',
  };
}

function pantryInviteFromDoc(data: Record<string, unknown> | undefined): PantryInvite {
  return {
    code: (data?.code as string | null) ?? null,
    expiresAt: tsToIso(data?.expiresAt),
  };
}

// Solo il creatore può leggere questo documento (regole): un membro che lo
// sottoscrive riceve un errore di permessi, non un valore vuoto — chiamarlo
// solo se `pantry.ownerId === user.uid`.
export function subscribeToPantryInvite(
  pantryId: string,
  onData: (invite: PantryInvite) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    doc(db, 'pantries', pantryId, 'private', 'invite'),
    (snap) => onData(pantryInviteFromDoc(snap.data())),
    onError,
  );
}

// Le dispense a cui l'utente appartiene (proprietario o membro): sola
// lettura diretta, le regole la permettono perché richiede solo che
// request.auth.uid sia già nel documento restituito.
export function subscribeToMyPantries(
  uid: string,
  onData: (pantries: Pantry[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(collection(db, 'pantries'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => pantryFromDoc(d.id, d.data()))),
    onError,
  );
}

export function subscribeToPantry(
  pantryId: string,
  onData: (pantry: Pantry | null) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    doc(db, 'pantries', pantryId),
    (snap) => onData(snap.exists() ? pantryFromDoc(snap.id, snap.data()) : null),
    onError,
  );
}

// Rinominare è l'unica scrittura diretta dal client (regole: solo il
// creatore, solo il campo `name`) — tutto il resto passa da Cloud Function
// perché tocca l'appartenenza (chi entra/esce) o il codice invito.
export async function renamePantry(pantryId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'pantries', pantryId), { name: name.trim().slice(0, 60) });
}

export interface CreatePantryResult {
  id: string;
  inviteCode: string;
  inviteCodeExpiresAt: string;
}

export async function createPantry(name: string, displayName: string): Promise<CreatePantryResult> {
  const call = httpsCallable<{ name: string; displayName: string }, CreatePantryResult>(functions, 'createPantry');
  const res = await call({ name, displayName });
  return res.data;
}

export interface JoinPantryResult {
  id: string;
  name: string;
  alreadyMember: boolean;
}

export async function joinPantry(code: string, displayName: string): Promise<JoinPantryResult> {
  const call = httpsCallable<{ code: string; displayName: string }, JoinPantryResult>(functions, 'joinPantry');
  const res = await call({ code: code.trim().toUpperCase(), displayName });
  return res.data;
}

export interface RotateInviteCodeResult {
  inviteCode: string;
  inviteCodeExpiresAt: string;
}

export async function rotateInviteCode(pantryId: string): Promise<RotateInviteCodeResult> {
  const call = httpsCallable<{ pantryId: string }, RotateInviteCodeResult>(functions, 'rotateInviteCode');
  const res = await call({ pantryId });
  return res.data;
}

export async function disableInviteCode(pantryId: string): Promise<void> {
  const call = httpsCallable<{ pantryId: string }, { ok: true }>(functions, 'disableInviteCode');
  await call({ pantryId });
}

export async function leavePantry(pantryId: string): Promise<void> {
  const call = httpsCallable<{ pantryId: string }, { ok: true }>(functions, 'leavePantry');
  await call({ pantryId });
}

export async function removeMember(pantryId: string, uid: string): Promise<void> {
  const call = httpsCallable<{ pantryId: string; uid: string }, { ok: true }>(functions, 'removeMember');
  await call({ pantryId, uid });
}

export async function deletePantry(pantryId: string): Promise<void> {
  const call = httpsCallable<{ pantryId: string }, { ok: true }>(functions, 'deletePantry');
  await call({ pantryId });
}
