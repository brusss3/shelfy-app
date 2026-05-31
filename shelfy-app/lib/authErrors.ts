// Traduce gli errori Firebase Auth in messaggi chiari in italiano.
// Usato da login e registrazione per evitare di mostrare "Firebase: Error (auth/...)".

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Indirizzo email non valido.',
  'auth/missing-email': 'Inserisci un indirizzo email.',
  'auth/user-disabled': 'Questo account è stato disabilitato.',
  'auth/user-not-found': 'Nessun account trovato con questa email.',
  'auth/wrong-password': 'Password errata. Riprova.',
  'auth/invalid-credential': 'Email o password non corretti.',
  'auth/invalid-login-credentials': 'Email o password non corretti.',
  'auth/email-already-in-use': 'Esiste già un account con questa email.',
  'auth/weak-password': 'La password è troppo debole (almeno 6 caratteri).',
  'auth/missing-password': 'Inserisci una password.',
  'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
  'auth/network-request-failed': 'Connessione assente. Controlla la rete e riprova.',
  'auth/operation-not-allowed': 'Operazione non consentita. Contatta il supporto.',
  'auth/internal-error': 'Errore interno. Riprova tra poco.',
  'auth/requires-recent-login': 'Per sicurezza, effettua di nuovo l’accesso.',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function authErrorMessage(error: any, fallback = 'Si è verificato un errore. Riprova.'): string {
  const code: string | undefined = error?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];

  // A volte il codice è incluso nel messaggio (es. "Firebase: Error (auth/wrong-password).")
  const raw: string = error?.message ?? '';
  const match = raw.match(/auth\/[a-z-]+/);
  if (match && MESSAGES[match[0]]) return MESSAGES[match[0]];

  return fallback;
}
