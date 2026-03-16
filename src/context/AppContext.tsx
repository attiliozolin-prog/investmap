'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { Strategy, Asset } from '@/types';
import { generateId } from '@/lib/calculations';

// ============================================
// Default Strategy (from the reference spreadsheet)
// ============================================

const DEFAULT_STRATEGY_ID = 'default-strategy';

const defaultStrategy: Strategy = {
  id: DEFAULT_STRATEGY_ID,
  name: 'Minha Carteira',
  description: 'Estratégia diversificada com foco em dividendos e crescimento',
  deviationTolerance: 3,
  categories: [
    { id: 'cat-1', strategyId: DEFAULT_STRATEGY_ID, className: 'Renda Fixa', subclassName: 'Renda Fixa', targetPercent: 52 },
    { id: 'cat-2', strategyId: DEFAULT_STRATEGY_ID, className: 'Renda Variável', subclassName: 'ETF - Exterior', targetPercent: 20 },
    { id: 'cat-3', strategyId: DEFAULT_STRATEGY_ID, className: 'Renda Variável', subclassName: 'Ações - Dividendos', targetPercent: 16 },
    { id: 'cat-4', strategyId: DEFAULT_STRATEGY_ID, className: 'Renda Variável', subclassName: 'FIIs', targetPercent: 12 },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================
// Context Types
// ============================================

interface AppContextType {
  strategies: Strategy[];
  activeStrategyId: string;
  activeStrategy: Strategy | null;
  assets: Asset[];
  activeAssets: Asset[];

  // Strategy actions
  createStrategy: (data: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt' | 'categories'>) => Strategy;
  updateStrategy: (id: string, data: Partial<Strategy>) => void;
  deleteStrategy: (id: string) => void;
  setActiveStrategy: (id: string) => void;

  // Category actions (within active strategy)
  addCategory: (data: Omit<import('@/types').StrategyCategory, 'id' | 'strategyId'>) => void;
  updateCategory: (id: string, data: Partial<import('@/types').StrategyCategory>) => void;
  deleteCategory: (id: string) => void;

  // Asset actions
  addAsset: (data: Omit<Asset, 'id' | 'updatedAt'>) => void;
  updateAsset: (id: string, data: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
}

// ============================================
// Storage helpers
// ============================================

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ============================================
// Context
// ============================================

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [activeStrategyId, setActiveStrategyId] = useState<string>(DEFAULT_STRATEGY_ID);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage<Strategy[]>('investmap_strategies', [defaultStrategy]);
    const storedActive = loadFromStorage<string>('investmap_active', DEFAULT_STRATEGY_ID);
    const storedAssets = loadFromStorage<Asset[]>('investmap_assets', []);

    setStrategies(stored.length > 0 ? stored : [defaultStrategy]);
    setActiveStrategyId(storedActive);
    setAssets(storedAssets);
    setInitialized(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (!initialized) return;
    saveToStorage('investmap_strategies', strategies);
  }, [strategies, initialized]);

  useEffect(() => {
    if (!initialized) return;
    saveToStorage('investmap_active', activeStrategyId);
  }, [activeStrategyId, initialized]);

  useEffect(() => {
    if (!initialized) return;
    saveToStorage('investmap_assets', assets);
  }, [assets, initialized]);

  const activeStrategy = strategies.find((s) => s.id === activeStrategyId) ?? null;
  const activeAssets = assets.filter((a) => a.strategyId === activeStrategyId);

  // Strategy actions
  const createStrategy = useCallback(
    (data: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt' | 'categories'>): Strategy => {
      const newStrategy: Strategy = {
        ...data,
        id: generateId(),
        categories: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setStrategies((prev) => [...prev, newStrategy]);
      return newStrategy;
    },
    [],
  );

  const updateStrategy = useCallback((id: string, data: Partial<Strategy>) => {
    setStrategies((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s,
      ),
    );
  }, []);

  const deleteStrategy = useCallback((id: string) => {
    setStrategies((prev) => prev.filter((s) => s.id !== id));
    setAssets((prev) => prev.filter((a) => a.strategyId !== id));
  }, []);

  const setActiveStrategy = useCallback((id: string) => {
    setActiveStrategyId(id);
  }, []);

  // Category actions
  const addCategory = useCallback(
    (data: Omit<import('@/types').StrategyCategory, 'id' | 'strategyId'>) => {
      if (!activeStrategyId) return;
      const newCat: import('@/types').StrategyCategory = {
        ...data,
        id: generateId(),
        strategyId: activeStrategyId,
      };
      setStrategies((prev) =>
        prev.map((s) =>
          s.id === activeStrategyId
            ? { ...s, categories: [...s.categories, newCat], updatedAt: new Date().toISOString() }
            : s,
        ),
      );
    },
    [activeStrategyId],
  );

  const updateCategory = useCallback(
    (id: string, data: Partial<import('@/types').StrategyCategory>) => {
      setStrategies((prev) =>
        prev.map((s) =>
          s.id === activeStrategyId
            ? {
                ...s,
                categories: s.categories.map((c) =>
                  c.id === id ? { ...c, ...data } : c,
                ),
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
    },
    [activeStrategyId],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      setStrategies((prev) =>
        prev.map((s) =>
          s.id === activeStrategyId
            ? {
                ...s,
                categories: s.categories.filter((c) => c.id !== id),
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
      setAssets((prev) => prev.filter((a) => a.categoryId !== id));
    },
    [activeStrategyId],
  );

  // Asset actions
  const addAsset = useCallback((data: Omit<Asset, 'id' | 'updatedAt'>) => {
    const newAsset: Asset = {
      ...data,
      id: generateId(),
      updatedAt: new Date().toISOString(),
    };
    setAssets((prev) => [...prev, newAsset]);
  }, []);

  const updateAsset = useCallback((id: string, data: Partial<Asset>) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a,
      ),
    );
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  if (!initialized) return null;

  return (
    <AppContext.Provider
      value={{
        strategies,
        activeStrategyId,
        activeStrategy,
        assets,
        activeAssets,
        createStrategy,
        updateStrategy,
        deleteStrategy,
        setActiveStrategy,
        addCategory,
        updateCategory,
        deleteCategory,
        addAsset,
        updateAsset,
        deleteAsset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
