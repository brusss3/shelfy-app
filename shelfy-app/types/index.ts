export type Zone = 'frigo' | 'freezer' | 'dispensa';

// Voti Nutri-Score / Eco-Score di Open Food Facts (scala europea A-E).
export type ScoreGrade = 'a' | 'b' | 'c' | 'd' | 'e';

// Valori nutrizionali per 100g/100ml, da Open Food Facts.
export interface NutritionInfo {
  calories?: number;
  proteins?: number;
  fat?: number;
  carbs?: number;
  sugars?: number;
  salt?: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  qty: string;
  zone: Zone;
  category: string;
  expiry: string;      // ISO date string YYYY-MM-DD
  added: string;       // ISO date string
  barcode?: string;
  tint: string;
  cal: number;
  userId?: string;
  openedAt?: string;    // ISO date YYYY-MM-DD — when the product was opened
  openExpiry?: string;  // ISO date YYYY-MM-DD — consume-by after opening
  // Dati facoltativi da Open Food Facts, presenti solo se il prodotto è
  // stato aggiunto tramite scanner barcode e la voce li aveva compilati.
  nutrition?: NutritionInfo;
  allergens?: string[];
  nutriscore?: ScoreGrade;
  ecoscore?: ScoreGrade;
}

export interface Recipe {
  id: string;
  title: string;
  time: string;
  difficulty: string;
  tint: string;
  uses: string[];
  tag: string;
  desc: string;
  steps: string[];
}

export interface SavedRecipe extends Recipe {
  completed: boolean;
  savedAt: string;
  completedAt?: string;
}

export type SubscriptionType = 'monthly' | 'annual';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  isPremium?: boolean;
  isAdmin?: boolean;
  subscriptionType?: SubscriptionType | null;
  subscriptionExpiresAt?: string | null;
  notificationsEnabled?: boolean;
  pushToken?: string;
  adminNotifNewUsers?: boolean;
  adminNotifFeedback?: boolean;
}

export type UrgencyKey = 'scaduto' | 'oggi' | 'domani' | 'urgente' | 'prossimo' | 'ok' | 'lungo';

export interface Urgency {
  key: UrgencyKey;
  label: string;
  color: string;
  soft: string;
  ink: string;
}

export interface ScannedProduct {
  name: string;
  brand: string;
  barcode: string;
  qty: string;
  category: string;
  zone: Zone;
  tint: string;
  suggestExpiry: number;
  nutrition?: NutritionInfo;
  allergens?: string[];
  nutriscore?: ScoreGrade;
  ecoscore?: ScoreGrade;
}
