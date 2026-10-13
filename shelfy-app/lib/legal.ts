import { Linking } from 'react-native';

// Documenti legali pubblici (public/privacy.html, termini.html,
// elimina-account.html): si aprono nel browser, così il testo è sempre quello
// aggiornato anche senza una nuova versione dell'app.
export const SITE_URL = 'https://shelfy-app.it';
export const PRIVACY_URL = `${SITE_URL}/privacy`;
export const TERMS_URL = `${SITE_URL}/termini`;
export const DELETE_ACCOUNT_URL = `${SITE_URL}/elimina-account`;
export const CONTACT_EMAIL = 'business.shelfy@gmail.com';

export function openUrl(url: string): void {
  Linking.openURL(url).catch(() => {});
}
