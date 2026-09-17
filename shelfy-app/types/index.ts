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
  qty: string;           // formato della confezione, testo libero ("1 L")
  count: number;         // unità identiche con la stessa scadenza
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
  // Presente solo sui prodotti di una dispensa condivisa: chi l'ha aggiunto.
  addedBy?: string;
  // Dati facoltativi da Open Food Facts, presenti solo se il prodotto è
  // stato aggiunto tramite scanner barcode e la voce li aveva compilati.
  nutrition?: NutritionInfo;
  allergens?: string[];
  nutriscore?: ScoreGrade;
  ecoscore?: ScoreGrade;
}

export interface RecipeIngredient {
  name: string;
  qty: string;
}

export interface CommunityRecipe {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  desc: string;
  time: string;
  difficulty: string;
  tag: string;
  tint: string;
  ingredients: RecipeIngredient[];
  steps: string[];
  ratingSum: number;
  ratingCount: number;
  createdAt: string;
}

export interface SavedRecipe extends CommunityRecipe {
  completed: boolean;
  savedAt: string;
  completedAt?: string;
}

export type MyRecipeSource = 'ai' | 'manual';

// Ricetta personale dell'utente: privata finché non viene pubblicata nella
// community. Le ricette generate dall'AI nascono qui.
export interface MyRecipe {
  id: string;
  title: string;
  desc: string;
  time: string;
  difficulty: string;
  tag: string;
  tint: string;
  ingredients: RecipeIngredient[];
  steps: string[];
  source: MyRecipeSource;
  published: boolean;
  publishedRecipeId?: string;
  createdAt: string;
}

export type RecipeRequestStatus = 'open' | 'closed';

export interface RecipeRequest {
  id: string;
  authorId: string;
  authorName: string;
  ingredients: string[];
  note: string;
  status: RecipeRequestStatus;
  createdAt: string;
}

export interface RecipeProposal {
  id: string;
  requestId: string;
  recipeId: string;
  authorId: string;
  authorName: string;
  createdAt: string;
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
  /** Blocco AI sul singolo account, impostabile solo dall'admin. */
  aiDisabled?: boolean;
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

// ---------------------------------------------------------------------------
// Dispensa condivisa
// ---------------------------------------------------------------------------

export type PantryRole = 'owner' | 'member';

export interface PantryMember {
  name: string;
  role: PantryRole;
  joinedAt: string;
}

export interface Pantry {
  id: string;
  name: string;
  ownerId: string;
  /** Duplica le chiavi di `members` in un array: serve alla query
   *  "a quali dispense appartengo" (array-contains), che su un oggetto
   *  non sarebbe possibile. */
  memberIds: string[];
  members: Record<string, PantryMember>;
  createdAt: string;
}

/** Vive in pantries/{id}/private/invite — leggibile SOLO dal creatore
 *  (mai dagli altri membri): è il pin "visibile da chi crea la dispensa". */
export interface PantryInvite {
  code: string | null;
  expiresAt: string | null;
}
