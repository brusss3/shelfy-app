import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { SubscriptionType } from '@/types';

export interface SubscriptionInfo {
  type: SubscriptionType;
  productId: string;
  expiresAt: string | null;
}

export const ENTITLEMENT_ID = 'premium';

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const extra = (Constants.expoConfig?.extra as any) ?? {};

export const RC_IOS_KEY = extra?.revenueCat?.iosKey || 'appl_YOUR_IOS_KEY';
export const RC_ANDROID_KEY = extra?.revenueCat?.androidKey || 'goog_YOUR_ANDROID_KEY';

function getPurchasesInstance(): any | null {
  if (isExpoGo || Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-purchases').default;
  } catch {
    return null;
  }
}

export function initPurchases(userId: string): void {
  const Purchases = getPurchasesInstance();
  if (!Purchases) return;

  const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
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

export async function restorePurchases(): Promise<boolean> {
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

export function openSubscriptionManagement(): void {
  const pkgName = (Constants.expoConfig?.android as any)?.package || 'com.shelfy.sheflyapp';
  const url =
    Platform.OS === 'ios'
      ? 'itms-apps://apps.apple.com/account/subscriptions'
      : `https://play.google.com/store/account/subscriptions?package=${pkgName}`;
  Linking.openURL(url).catch(() => {});
}
