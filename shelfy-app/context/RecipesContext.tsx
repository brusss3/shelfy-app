import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeToMyRecipes, createMyRecipe, deleteMyRecipe, markMyRecipePublished,
  createCommunityRecipe, hasUsedDailyAi, subscribeToAiEnabled,
} from '@/lib/firestore';
import { CommunityRecipe, SavedRecipe, MyRecipe } from '@/types';

interface RecipesContextType {
  /** Ricette della community messe da parte dall'utente. */
  savedRecipes: SavedRecipe[];
  /** Ricette scritte dall'utente o generate dall'AI, private finché non pubblicate. */
  myRecipes: MyRecipe[];
  loading: boolean;
  /** True se la generazione AI di oggi è già stata usata. */
  aiUsedToday: boolean;
  /** False se l'admin ha spento l'AI globalmente o su questo account. */
  aiEnabled: boolean;
  refreshAiUsage: () => Promise<void>;
  saveRecipe: (recipe: CommunityRecipe) => Promise<void>;
  markCompleted: (recipeId: string) => Promise<void>;
  addMyRecipe: (data: Omit<MyRecipe, 'id' | 'published' | 'publishedRecipeId' | 'createdAt'>) => Promise<string>;
  removeMyRecipe: (recipeId: string) => Promise<void>;
  publishMyRecipe: (recipe: MyRecipe) => Promise<string>;
}

const RecipesContext = createContext<RecipesContextType>({} as RecipesContextType);

export function RecipesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [myRecipes, setMyRecipes] = useState<MyRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiUsedToday, setAiUsedToday] = useState(false);
  const [aiGloballyEnabled, setAiGloballyEnabled] = useState(true);

  useEffect(() => {
    if (!user) { setSavedRecipes([]); setMyRecipes([]); setAiUsedToday(false); return; }
    setLoading(true);

    const savedRef = collection(db, 'users', user.uid, 'savedRecipes');
    const unsubSaved = onSnapshot(savedRef, (snap) => {
      const recipes = snap.docs.map((d) => d.data() as SavedRecipe);
      recipes.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      setSavedRecipes(recipes);
      setLoading(false);
    }, () => setLoading(false));

    const unsubMine = subscribeToMyRecipes(user.uid, setMyRecipes, () => {});
    const unsubAi = subscribeToAiEnabled(setAiGloballyEnabled, () => {});

    hasUsedDailyAi(user.uid).then(setAiUsedToday).catch(() => {});

    return () => { unsubSaved(); unsubMine(); unsubAi(); };
  }, [user?.uid]);

  const refreshAiUsage = useCallback(async () => {
    if (!user) return;
    setAiUsedToday(await hasUsedDailyAi(user.uid).catch(() => false));
  }, [user?.uid]);

  const saveRecipe = async (recipe: CommunityRecipe) => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'savedRecipes', recipe.id);
    await setDoc(ref, { ...recipe, completed: false, savedAt: new Date().toISOString() }, { merge: true });
  };

  const markCompleted = async (recipeId: string) => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'savedRecipes', recipeId);
    await updateDoc(ref, { completed: true, completedAt: new Date().toISOString() });
  };

  const addMyRecipe = useCallback(
    async (data: Omit<MyRecipe, 'id' | 'published' | 'publishedRecipeId' | 'createdAt'>) => {
      if (!user) throw new Error('Devi accedere per salvare una ricetta');
      return createMyRecipe(user.uid, data);
    },
    [user?.uid],
  );

  const removeMyRecipe = useCallback(
    async (recipeId: string) => {
      if (!user) return;
      await deleteMyRecipe(user.uid, recipeId);
    },
    [user?.uid],
  );

  // Copia la ricetta privata nella community e segna l'originale come pubblicata,
  // così resta tracciato il legame tra le due.
  const publishMyRecipe = useCallback(
    async (recipe: MyRecipe) => {
      if (!user) throw new Error('Devi accedere per pubblicare');
      const communityId = await createCommunityRecipe({
        authorId: user.uid,
        authorName: user.displayName ?? 'Utente Shelfy',
        title: recipe.title,
        desc: recipe.desc,
        time: recipe.time,
        difficulty: recipe.difficulty,
        tag: recipe.tag,
        tint: recipe.tint,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
      });
      await markMyRecipePublished(user.uid, recipe.id, communityId);
      return communityId;
    },
    [user?.uid, user?.displayName],
  );

  return (
    <RecipesContext.Provider
      value={{
        savedRecipes, myRecipes, loading, aiUsedToday,
        aiEnabled: aiGloballyEnabled && !user?.aiDisabled,
        refreshAiUsage,
        saveRecipe, markCompleted, addMyRecipe, removeMyRecipe, publishMyRecipe,
      }}
    >
      {children}
    </RecipesContext.Provider>
  );
}

export const useRecipes = () => useContext(RecipesContext);
