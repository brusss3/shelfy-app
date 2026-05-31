// ─── RevenueCat — DISABILITATO temporaneamente ────────────────────────────
// Da riabilitare quando si configura il Play Store.
// Per riattivare: decommentare il blocco RC() e le funzioni sottostanti,
// e ripristinare initPurchases/checkPremiumStatus in AuthContext.
// ──────────────────────────────────────────────────────────────────────────

import { Platform, Linking } from 'react-native';
import { SubscriptionType } from '@/types';

export interface SubscriptionInfo {
  type: SubscriptionType;
  productId: string;
  expiresAt: string | null;
}

export const ENTITLEMENT_ID = 'premium';

// function RC(): any | null {
//   const isExpoGo = require('expo-constants').default.executionEnvironment === 'storeClient';
//   if (isExpoGo) return null;
//   try { return require('react-native-purchases').default; } catch { return null; }
// }
// export const RC_IOS_KEY    = 'test_wbrrzHhpbWlOmMNeOQXpgdeeOXG';
// export const RC_ANDROID_KEY = 'test_wbrrzHhpbWlOmMNeOQXpgdeeOXG';

export function initPurchases(_userId: string): void {
  // const Purchases = RC(); if (!Purchases) return;
  // const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
  // Purchases.configure({ apiKey, appUserID: _userId });
}

export async function getOfferings(): Promise<any[]> {
  // const Purchases = RC(); if (!Purchases) return [];
  // const offerings = await Purchases.getOfferings();
  // return offerings.current?.availablePackages ?? [];
  return [];
}

export async function purchasePackage(_pkg: any): Promise<boolean> {
  // const Purchases = RC(); if (!Purchases) return false;
  // const { customerInfo } = await Purchases.purchasePackage(_pkg);
  // return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  return false;
}

export async function restorePurchases(): Promise<boolean> {
  // const Purchases = RC(); if (!Purchases) return false;
  // const customerInfo = await Purchases.restorePurchases();
  // return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  return false;
}

export async function checkPremiumStatus(): Promise<boolean> {
  // const Purchases = RC(); if (!Purchases) return false;
  // const customerInfo = await Purchases.getCustomerInfo();
  // return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  return false;
}

export async function getActiveSubscriptionInfo(): Promise<SubscriptionInfo | null> {
  // const Purchases = RC(); if (!Purchases) return null;
  // const customerInfo = await Purchases.getCustomerInfo();
  // const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
  // if (!entitlement) return null;
  // const productId: string = entitlement.productIdentifier ?? '';
  // const lower = productId.toLowerCase();
  // const type: SubscriptionType = lower.includes('annual') || lower.includes('yearly') ? 'annual' : 'monthly';
  // return { type, productId, expiresAt: entitlement.expirationDate ?? null };
  return null;
}

export function openSubscriptionManagement(): void {
  const url =
    Platform.OS === 'ios'
      ? 'itms-apps://apps.apple.com/account/subscriptions'
      : `https://play.google.com/store/account/subscriptions?package=com.shelfy.sheflyapp`;
  Linking.openURL(url).catch(() => {});
}
