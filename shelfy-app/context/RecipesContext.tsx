import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Recipe, SavedRecipe } from '@/types';

interface RecipesContextType {
  savedRecipes: SavedRecipe[];
  loading: boolean;
  saveRecipe: (recipe: Recipe) => Promise<void>;
  markCompleted: (recipeId: string) => Promise<void>;
}

const RecipesContext = createContext<RecipesContextType>({
  savedRecipes: [],
  loading: false,
  saveRecipe: async () => {},
  markCompleted: async () => {},
});

export function RecipesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { setSavedRecipes([]); return; }
    setLoading(true);
    const ref = collection(db, 'users', user.uid, 'savedRecipes');
    const unsub = onSnapshot(ref, (snap) => {
      const recipes = snap.docs.map((d) => d.data() as SavedRecipe);
      recipes.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      setSavedRecipes(recipes);
      setLoading(false);
    }, () => {
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const saveRecipe = async (recipe: Recipe) => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'savedRecipes', recipe.id);
    await setDoc(ref, { ...recipe, completed: false, savedAt: new Date().toISOString() }, { merge: true });
  };

  const markCompleted = async (recipeId: string) => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'savedRecipes', recipeId);
    await updateDoc(ref, { completed: true, completedAt: new Date().toISOString() });
  };

  return (
    <RecipesContext.Provider value={{ savedRecipes, loading, saveRecipe, markCompleted }}>
      {children}
    </RecipesContext.Provider>
  );
}

export const useRecipes = () => useContext(RecipesContext);
