import { router } from 'expo-router';
import i18n from '@/lib/i18n';
import { showAlert } from '@/lib/alert';
import { FREE_PRODUCT_LIMIT, ProductLimitError } from '@/lib/limits';

// Alert unico per il tetto prodotti: lo usano tutti i punti che aggiungono
// (manuale, scanner barcode, scontrino), così il messaggio e la via d'uscita
// verso il paywall restano identici ovunque.
export function showProductLimitAlert(): void {
  showAlert(
    i18n.t('limits.productLimitTitle'),
    i18n.t('limits.productLimitBody', { limit: FREE_PRODUCT_LIMIT }),
    [
      { text: i18n.t('common.cancel'), style: 'cancel' },
      { text: i18n.t('limits.unlockCta'), onPress: () => router.push('/paywall') },
    ],
  );
}

/** True se l'errore era il tetto prodotti (e l'alert è già stato mostrato). */
export function handledProductLimit(e: unknown): boolean {
  if (e instanceof ProductLimitError) {
    showProductLimitAlert();
    return true;
  }
  return false;
}
