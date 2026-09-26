import { router } from 'expo-router';
import i18n from '@/lib/i18n';
import { showAlert } from '@/lib/alert';
import { joinPremiumWaitlist } from '@/lib/firestore';
import { FREE_PRODUCT_LIMIT, ProductLimitError } from '@/lib/limits';
import { useAuth } from '@/context/AuthContext';

// Unico punto che decide cosa succede quando un utente del piano base tocca
// un limite: con i piani in vendita porta al paywall, altrimenti raccoglie
// l'interesse in lista d'attesa. Così nessuna schermata deve sapere se la
// monetizzazione è accesa.
export function usePremiumGate() {
  const { user, monetizationEnabled } = useAuth();

  const promptWaitlist = (titleKey: string, bodyKey: string, bodyVars?: Record<string, unknown>) => {
    showAlert(i18n.t(titleKey), i18n.t(bodyKey, bodyVars ?? {}), [
      { text: i18n.t('common.close'), style: 'cancel' },
      {
        text: i18n.t('limits.notifyMeCta'),
        onPress: () => {
          if (!user) return;
          joinPremiumWaitlist(user.uid)
            .then(() => showAlert(i18n.t('limits.waitlistDoneTitle'), i18n.t('limits.waitlistDoneBody')))
            .catch(() => showAlert(i18n.t('common.error'), i18n.t('limits.waitlistFailed')));
        },
      },
    ]);
  };

  return {
    monetizationEnabled,

    /** Limite prodotti raggiunto. */
    onProductLimit: () => {
      if (monetizationEnabled) {
        showAlert(i18n.t('limits.productLimitTitle'), i18n.t('limits.productLimitBody', { limit: FREE_PRODUCT_LIMIT }), [
          { text: i18n.t('common.cancel'), style: 'cancel' },
          { text: i18n.t('limits.unlockCta'), onPress: () => router.push('/paywall') },
        ]);
        return;
      }
      promptWaitlist('limits.productLimitTitle', 'limits.productLimitSoonBody', { limit: FREE_PRODUCT_LIMIT });
    },

    /** Invito a sbloccare mostrato fuori da un errore (banner, ricette). */
    onUpgradeIntent: () => {
      if (monetizationEnabled) {
        router.push('/paywall');
        return;
      }
      promptWaitlist('limits.comingSoonTitle', 'limits.comingSoonBody');
    },
  };
}

/** True se l'errore era il tetto prodotti: il chiamante ha già mostrato l'avviso. */
export function isProductLimitError(e: unknown): boolean {
  return e instanceof ProductLimitError;
}
