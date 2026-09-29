import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { auth } from '@/lib/firebase';
import { SubscriptionType } from '@/types';

export interface SubscriptionInfo {
  type: SubscriptionType;
  productId: string;
  expiresAt: string | null;
}

export const ENTITLEMENT_ID = 'premium';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Letta a ogni chiamata, non all'import: su web `Constants.expoConfig` non è
// ancora popolato quando questo modulo viene valutato (lo importa AuthContext,
// che parte prestissimo), e le chiavi resterebbero vuote per sempre.
function rcConfig(): any {
  return (Constants.expoConfig?.extra as any)?.revenueCat ?? {};
}

export function getIosKey(): string {
  return rcConfig().iosKey || 'appl_YOUR_IOS_KEY';
}

export function getAndroidKey(): string {
  return rcConfig().androidKey || 'goog_YOUR_ANDROID_KEY';
}

// Web Billing: chiave sandbox in sviluppo (Stripe test cards), prod nel sito
// pubblicato. `__DEV__` è false nei bundle esportati con `expo export`.
export function getWebKey(): string {
  const cfg = rcConfig();
  return (__DEV__ ? cfg.webKeySandbox : cfg.webKey) || '';
}

function getPurchasesInstance(): any | null {
  if (isExpoGo || Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-purchases').default;
  } catch {
    return null;
  }
}

// --- Web Billing (@revenuecat/purchases-js) ---

async function getWebPurchases(): Promise<any | null> {
  if (Platform.OS !== 'web') return null;
  try {
    return await import('@revenuecat/purchases-js');
  } catch {
    return null;
  }
}

// Una sola configure in volo: getOfferings() e checkPremiumStatus() possono
// partire insieme al primo render del paywall.
let webConfigurePromise: Promise<any | null> | null = null;

async function getWebPurchasesInstance(appUserId?: string): Promise<any | null> {
  const mod = await getWebPurchases();
  if (!mod) return null;
  const { Purchases } = mod;
  if (Purchases.isConfigured()) return Purchases.getSharedInstance();

  // L'uid arriva da initPurchases() al login, ma le altre funzioni possono
  // essere chiamate prima (o dopo un Fast Refresh che non rilancia l'auth
  // listener): in quel caso lo prendiamo direttamente da Firebase Auth, così
  // l'ordine delle chiamate non conta.
  const uid = appUserId ?? auth.currentUser?.uid;
  if (!uid) {
    console.warn('[RevenueCat Web] Nessun utente loggato: configure saltata');
    return null;
  }

  const apiKey = getWebKey();
  if (!apiKey) {
    // Se la chiave c'è in app.json ma qui risulta vuota, il bundle sta usando
    // una copia vecchia della config: serve `expo start --clear`.
    console.warn('[RevenueCat Web] Chiave mancante in app.json → extra.revenueCat');
    return null;
  }

  if (!webConfigurePromise) {
    webConfigurePromise = (async () => {
      try {
        return Purchases.configure(apiKey, uid);
      } catch (e) {
        console.warn('[RevenueCat Web] Inizializzazione fallita:', e);
        webConfigurePromise = null;
        return null;
      }
    })();
  }
  return webConfigurePromise;
}

// L'SDK web usa identificatori diversi da quello nativo ($rc_annual invece di
// ANNUAL): li normalizziamo così PaywallScreen non deve sapere da quale SDK
// arriva un package.
function normalizeWebPackageType(packageType: string): string {
  if (packageType === '$rc_annual') return 'ANNUAL';
  if (packageType === '$rc_monthly') return 'MONTHLY';
  return packageType.replace('$rc_', '').toUpperCase();
}

// Riforma un Package dell'SDK web nella stessa forma (identifier, packageType,
// product.{price,priceString,title}) che PaywallScreen già sa disegnare per i
// package nativi. `__webPackage` porta con sé l'oggetto originale, serve a
// purchasePackage() per passarlo a instance.purchase().
function adaptWebPackage(pkg: any) {
  const product = pkg.webBillingProduct;
  return {
    identifier: pkg.identifier,
    packageType: normalizeWebPackageType(pkg.packageType),
    product: {
      price: product.price.amountMicros / 1_000_000,
      priceString: product.price.formattedPrice,
      title: product.title,
    },
    __webPackage: pkg,
  };
}

export function initPurchases(userId: string): void {
  if (Platform.OS === 'web') {
    getWebPurchasesInstance(userId).catch((e) => console.warn('[RevenueCat Web] configure fallita:', e));
    return;
  }

  const Purchases = getPurchasesInstance();
  if (!Purchases) return;

  const apiKey = Platform.OS === 'ios' ? getIosKey() : getAndroidKey();
  if (!apiKey || apiKey.startsWith('appl_YOUR') || apiKey.startsWith('goog_YOUR')) {
    return;
  }

  try {
    Purchases.configure({ apiKey, appUserID: userId });
  } catch (e) {
    console.warn('[RevenueCat] Inizializzazione fallita:', e);
  }
}

export async function getOfferings(): Promise<any[]> {
  if (Platform.OS === 'web') {
    const instance = await getWebPurchasesInstance();
    if (!instance) return [];
    try {
      const offerings = await instance.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      if (packages.length === 0) {
        console.warn('[RevenueCat Web] Offering "current" senza package disponibili:', offerings);
      }
      return packages.map(adaptWebPackage);
    } catch (e) {
      console.warn('[RevenueCat Web] Recupero offerte fallito:', e);
      return [];
    }
  }

  const Purchases = getPurchasesInstance();
  if (!Purchases) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch (e) {
    console.warn('[RevenueCat] Recupero offerte fallito:', e);
    return [];
  }
}

export async function purchasePackage(pkg: any): Promise<boolean> {
  if (Platform.OS === 'web') {
    const instance = await getWebPurchasesInstance();
    if (!instance || !pkg?.__webPackage) return false;
    try {
      const { customerInfo } = await instance.purchase({ rcPackage: pkg.__webPackage });
      return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    } catch (e: any) {
      if (e?.errorCode === 1 /* ErrorCode.UserCancelledError */) return false;
      throw e;
    }
  }

  const Purchases = getPurchasesInstance();
  if (!Purchases) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

// Il Web Billing non ha un vero "restore" (l'acquisto è già legato
// all'appUserId loggato): rileggere lo stato dell'abbonamento equivale a
// ripristinarlo, utile ad es. su un nuovo browser con lo stesso account.
export async function restorePurchases(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return checkPremiumStatus();
  }

  const Purchases = getPurchasesInstance();
  if (!Purchases) return false;
  try {
    const customerInfo = await Purchases.restorePurchases();
    return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  } catch (e) {
    console.warn('[RevenueCat] Ripristino acquisti fallito:', e);
    return false;
  }
}

export async function checkPremiumStatus(): Promise<boolean> {
  if (Platform.OS === 'web') {
    const instance = await getWebPurchasesInstance();
    if (!instance) return false;
    try {
      return await instance.isEntitledTo(ENTITLEMENT_ID);
    } catch {
      return false;
    }
  }

  const Purchases = getPurchasesInstance();
  if (!Purchases) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}

export async function getActiveSubscriptionInfo(): Promise<SubscriptionInfo | null> {
  if (Platform.OS === 'web') {
    const instance = await getWebPurchasesInstance();
    if (!instance) return null;
    try {
      const customerInfo = await instance.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      if (!entitlement) return null;
      const productId: string = entitlement.productIdentifier ?? '';
      const lower = productId.toLowerCase();
      const type: SubscriptionType = lower.includes('annual') || lower.includes('yearly') ? 'annual' : 'monthly';
      const expiresAt = entitlement.expirationDate instanceof Date ? entitlement.expirationDate.toISOString() : null;
      return { type, productId, expiresAt };
    } catch {
      return null;
    }
  }

  const Purchases = getPurchasesInstance();
  if (!Purchases) return null;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    if (!entitlement) return null;
    const productId: string = entitlement.productIdentifier ?? '';
    const lower = productId.toLowerCase();
    const type: SubscriptionType = lower.includes('annual') || lower.includes('yearly') ? 'annual' : 'monthly';
    return { type, productId, expiresAt: entitlement.expirationDate ?? null };
  } catch {
    return null;
  }
}

export async function openSubscriptionManagement(): Promise<void> {
  if (Platform.OS === 'web') {
    const instance = await getWebPurchasesInstance();
    try {
      const customerInfo = await instance?.getCustomerInfo();
      if (customerInfo?.managementURL) {
        Linking.openURL(customerInfo.managementURL).catch(() => {});
      }
    } catch {
      // silenzioso: il chiamante mostra già un fallback se serve
    }
    return;
  }

  const pkgName = (Constants.expoConfig?.android as any)?.package || 'it.shelfyapp';
  const url =
    Platform.OS === 'ios'
      ? 'itms-apps://apps.apple.com/account/subscriptions'
      : `https://play.google.com/store/account/subscriptions?package=${pkgName}`;
  Linking.openURL(url).catch(() => {});
}
