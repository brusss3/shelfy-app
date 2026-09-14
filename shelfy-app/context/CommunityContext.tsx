import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  subscribeToCommunityRecipes, createCommunityRecipe, deleteCommunityRecipe, rateRecipe as rateRecipeApi,
  subscribeToRecipeRequests, createRecipeRequest, closeRecipeRequest,
} from '@/lib/firestore';
import { CommunityRecipe, RecipeRequest } from '@/types';
import { useAuth } from './AuthContext';

interface CommunityContextType {
  recipes: CommunityRecipe[];
  requests: RecipeRequest[];
  loading: boolean;
  createRecipe: (data: Omit<CommunityRecipe, 'id' | 'authorId' | 'authorName' | 'ratingSum' | 'ratingCount' | 'createdAt'>) => Promise<string>;
  deleteRecipe: (id: string) => Promise<void>;
  rateRecipe: (recipeId: string, value: number) => Promise<void>;
  createRequest: (data: { ingredients: string[]; note: string }) => Promise<string>;
  closeRequest: (id: string) => Promise<void>;
}

const CommunityContext = createContext<CommunityContextType>({} as CommunityContextType);

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<CommunityRecipe[]>([]);
  const [requests, setRequests] = useState<RecipeRequest[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [requestsLoaded, setRequestsLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setRecipes([]); setRequests([]); return; }
    const unsubRecipes = subscribeToCommunityRecipes((data) => {
      setRecipes(data);
      setRecipesLoaded(true);
    }, () => setRecipesLoaded(true));
    const unsubRequests = subscribeToRecipeRequests((data) => {
      setRequests(data);
      setRequestsLoaded(true);
    }, () => setRequestsLoaded(true));
    return () => { unsubRecipes(); unsubRequests(); };
  }, [user?.uid]);

  const createRecipe = useCallback(
    async (data: Omit<CommunityRecipe, 'id' | 'authorId' | 'authorName' | 'ratingSum' | 'ratingCount' | 'createdAt'>) => {
      if (!user) throw new Error('Devi accedere per pubblicare una ricetta');
      return createCommunityRecipe({
        ...data,
        authorId: user.uid,
        authorName: user.displayName ?? 'Utente Shelfy',
      });
    },
    [user],
  );

  const deleteRecipe = useCallback(async (id: string) => {
    await deleteCommunityRecipe(id);
  }, []);

  const rateRecipe = useCallback(
    async (recipeId: string, value: number) => {
      if (!user) return;
      await rateRecipeApi(recipeId, user.uid, value);
    },
    [user],
  );

  const createRequest = useCallback(
    async (data: { ingredients: string[]; note: string }) => {
      if (!user) throw new Error('Devi accedere per chiedere aiuto');
      return createRecipeRequest({
        ...data,
        authorId: user.uid,
        authorName: user.displayName ?? 'Utente Shelfy',
      });
    },
    [user],
  );

  const closeRequest = useCallback(async (id: string) => {
    await closeRecipeRequest(id);
  }, []);

  return (
    <CommunityContext.Provider
      value={{
        recipes, requests, loading: !recipesLoaded || !requestsLoaded,
        createRecipe, deleteRecipe, rateRecipe, createRequest, closeRequest,
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
}

export const useCommunity = () => useContext(CommunityContext);
