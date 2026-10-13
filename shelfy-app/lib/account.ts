import { Platform, Share } from 'react-native';
import { callable } from './callable';

// Diritti dell'utente sui propri dati (GDPR art. 17 e 20): le funzioni vere
// stanno in functions/src/account.ts.

const exportData = callable<void, Record<string, unknown>>('exportMyData');
const deleteAccount = callable<void, { ok: true }>('deleteMyAccount');

/** Elimina l'account e i dati (le ricette pubbliche restano anonime). */
export async function deleteMyAccount(): Promise<void> {
  await deleteAccount();
}

/** True se il server chiede di rifare l'accesso prima di eliminare. */
export function needsRecentLogin(e: unknown): boolean {
  return (e as { details?: { key?: string } })?.details?.key === 'recentLoginRequired';
}

/** Scarica (web) o condivide (telefono) i dati dell'utente in formato JSON. */
export async function downloadMyData(): Promise<void> {
  const { data } = await exportData();
  const json = JSON.stringify(data, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `shelfy-dati-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  // Sul telefono il foglio di condivisione permette di mandarlo a sé stessi
  // (email, Drive, note…) senza servire un modulo nativo in più.
  await Share.share({ title: `shelfy-dati-${stamp}.json`, message: json });
}
