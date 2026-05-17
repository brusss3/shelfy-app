export type Zone = 'frigo' | 'freezer' | 'dispensa';

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

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  isPremium?: boolean;
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
}
