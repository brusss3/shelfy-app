// Traduce gli errori Firebase Auth in messaggi chiari (localizzati).
// Usato da login e registrazione per evitare di mostrare "Firebase: Error (auth/...)".
import i18n from '@/lib/i18n';

const CODE_KEYS: Record<string, string> = {
  'auth/invalid-email': 'auth.errors.invalidEmail',
  'auth/missing-email': 'auth.errors.missingEmail',
  'auth/user-disabled': 'auth.errors.userDisabled',
  'auth/user-not-found': 'auth.errors.userNotFound',
  'auth/wrong-password': 'auth.errors.wrongPassword',
  'auth/invalid-credential': 'auth.errors.invalidCredential',
  'auth/invalid-login-credentials': 'auth.errors.invalidCredential',
  'auth/email-already-in-use': 'auth.errors.emailInUse',
  'auth/weak-password': 'auth.errors.weakPassword',
  'auth/missing-password': 'auth.errors.missingPassword',
  'auth/too-many-requests': 'auth.errors.tooManyRequests',
  'auth/network-request-failed': 'auth.errors.networkFailed',
  'auth/operation-not-allowed': 'auth.errors.operationNotAllowed',
  'auth/internal-error': 'auth.errors.internalError',
  'auth/requires-recent-login': 'auth.errors.requiresRecentLogin',
};

function resolveKey(error: any): string | undefined { // eslint-disable-line @typescript-eslint/no-explicit-any
  const code: string | undefined = error?.code;
  if (code && CODE_KEYS[code]) return CODE_KEYS[code];

  // A volte il codice è incluso nel messaggio (es. "Firebase: Error (auth/wrong-password).")
  const raw: string = error?.message ?? '';
  const match = raw.match(/auth\/[a-z-]+/);
  if (match && CODE_KEYS[match[0]]) return CODE_KEYS[match[0]];

  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function authErrorMessage(error: any, fallback?: string): string {
  const key = resolveKey(error);
  if (key) return i18n.t(key);
  return fallback ?? i18n.t('auth.genericError');
}
