'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { Strategy, Asset, StrategyCategory, Transaction, PortfolioSnapshot } from '@/types';
import { generateId } from '@/lib/calculations';

// ============================================
// Default Strategy
// ============================================

const DEFAULT_STRATEGY_ID = 'default-strategy';
const STATIC_DATE = '2026-01-01T00:00:00.000Z'; // data estática para evitar mismatch servidor/cliente

function makeDefaultStrategy(): Strategy {
  return {
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
    createdAt: STATIC_DATE,
    updatedAt: STATIC_DATE,
  };
}

// ============================================
// Context Types
// ============================================

interface AppContextType {
  hasCompletedOnboarding: boolean;
  completeOnboarding: (categories: Omit<StrategyCategory, 'id' | 'strategyId'>[]) => void;
  strategies: Strategy[];
  activeStrategyId: string;
  activeStrategy: Strategy | null;
  assets: Asset[];
  activeAssets: Asset[];
  transactions: Transaction[];
  snapshots: PortfolioSnapshot[];

  createStrategy: (data: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt' | 'categories'>) => Strategy;
  updateStrategy: (id: string, data: Partial<Strategy>) => void;
  deleteStrategy: (id: string) => void;
  setActiveStrategy: (id: string) => void;

  addCategory: (data: Omit<StrategyCategory, 'id' | 'strategyId'>) => void;
  updateCategory: (id: string, data: Partial<StrategyCategory>) => void;
  deleteCategory: (id: string) => void;

  addAsset: (data: Omit<Asset, 'id' | 'updatedAt'>) => void;
  updateAsset: (id: string, data: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
  
  addTransaction: (data: Omit<Transaction, 'id' | 'date'>) => void;
  saveSnapshot: (snapshot: Omit<PortfolioSnapshot, 'id'>) => void;

  importData: (strategies: Strategy[], assets: Asset[], transactions?: Transaction[], snapshots?: PortfolioSnapshot[]) => void;
}

// ============================================
// Storage helpers
// ============================================

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

// ============================================
// Context
// ============================================

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const defaultStrategy = makeDefaultStrategy();

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [strategies, setStrategies] = useState<Strategy[]>([defaultStrategy]);
  const [activeStrategyId, setActiveStrategyId] = useState<string>(DEFAULT_STRATEGY_ID);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  
  // mounted garante que só rodamos no cliente, evitando mismatch de hidratação
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Carrega dados do localStorage apenas no cliente após montar
    const storedOnboarding = loadFromStorage<boolean>('investmap_onboarding', false);
    const stored = loadFromStorage<Strategy[]>('investmap_strategies', [defaultStrategy]);
    const storedActive = loadFromStorage<string>('investmap_active', DEFAULT_STRATEGY_ID);
    const storedAssets = loadFromStorage<Asset[]>('investmap_assets', []);
    const storedTransactions = loadFromStorage<Transaction[]>('investmap_transactions', []);
    const storedSnapshots = loadFromStorage<PortfolioSnapshot[]>('investmap_snapshots', []);

    setHasCompletedOnboarding(storedOnboarding);
    setStrategies(stored.length > 0 ? stored : [defaultStrategy]);
    setActiveStrategyId(storedActive);
    setAssets(storedAssets);
    setTransactions(storedTransactions);
    setSnapshots(storedSnapshots);
    setMounted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persiste no localStorage após montar (sem causar loop)
  useEffect(() => {
    if (!mounted) return;
    saveToStorage('investmap_onboarding', hasCompletedOnboarding);
  }, [hasCompletedOnboarding, mounted]);

  useEffect(() => {
    if (!mounted) return;
    saveToStorage('investmap_strategies', strategies);
  }, [strategies, mounted]);

  useEffect(() => {
    if (!mounted) return;
    saveToStorage('investmap_active', activeStrategyId);
  }, [activeStrategyId, mounted]);

  useEffect(() => {
    if (!mounted) return;
    saveToStorage('investmap_assets', assets);
  }, [assets, mounted]);

  useEffect(() => {
    if (!mounted) return;
    saveToStorage('investmap_transactions', transactions);
  }, [transactions, mounted]);

  useEffect(() => {
    if (!mounted) return;
    saveToStorage('investmap_snapshots', snapshots);
  }, [snapshots, mounted]);

  const activeStrategy = strategies.find((s) => s.id === activeStrategyId) ?? null;
  const activeAssets = assets.filter((a) => a.strategyId === activeStrategyId);

  // Onboarding actions
  const completeOnboarding = useCallback((categories: Omit<StrategyCategory, 'id' | 'strategyId'>[]) => {
    setStrategies((prev) => 
      prev.map((s) => {
        if (s.id === activeStrategyId) {
          const newCats: StrategyCategory[] = categories.map(c => ({
            ...c,
            id: generateId(),
            strategyId: activeStrategyId,
          }));
          return { ...s, categories: newCats, updatedAt: new Date().toISOString() };
        }
        return s;
      })
    );
    setHasCompletedOnboarding(true);
  }, [activeStrategyId]);

  // Strategy actions
  const createStrategy = useCallback(
    (data: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt' | 'categories'>): Strategy => {
      const now = new Date().toISOString();
      const newStrategy: Strategy = {
        ...data,
        id: generateId(),
        categories: [],
        createdAt: now,
        updatedAt: now,
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
    (data: Omit<StrategyCategory, 'id' | 'strategyId'>) => {
      const newCat: StrategyCategory = {
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
    (id: string, data: Partial<StrategyCategory>) => {
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

    // O primeiro aporte de um ativo também é uma transação
    addTransaction({
      assetId: newAsset.id,
      type: 'buy',
      value: newAsset.investedValue
    });
  }, [/* dependency on addTransaction injected securely via setTransactions internal logic later, or we just rely on setTransactions being stable */]);

  const updateAsset = useCallback((id: string, data: Partial<Asset>) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a,
      ),
    );
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    // Limpar transações atreladas ao ativo deletado
    setTransactions((prev) => prev.filter((t) => t.assetId !== id));
  }, []);

  const addTransaction = useCallback((data: Omit<Transaction, 'id' | 'date'>) => {
    const newTransaction: Transaction = {
      ...data,
      id: generateId(),
      date: new Date().toISOString(),
    };
    setTransactions((prev) => [...prev, newTransaction]);
  }, []);

  const saveSnapshot = useCallback((data: Omit<PortfolioSnapshot, 'id'>) => {
    const newSnapshot: PortfolioSnapshot = {
      ...data,
      id: generateId(),
    };
    
    setSnapshots((prev) => {
      // Verifica se já existe snapshot na mesma data estrita (YYYY-MM-DD) e strategyId
      const existingIndex = prev.findIndex(
        (s) => s.strategyId === newSnapshot.strategyId && s.date === newSnapshot.date
      );
      
      if (existingIndex >= 0) {
        // Atualiza a foto de hoje se a carteira mudou de valor hoje
        const arr = [...prev];
        arr[existingIndex] = { ...arr[existingIndex], ...newSnapshot };
        return arr;
      } else {
        return [...prev, newSnapshot];
      }
    });
  }, []);

  const importData = useCallback((
    importedStrategies: Strategy[], 
    importedAssets: Asset[],
    importedTransactions?: Transaction[],
    importedSnapshots?: PortfolioSnapshot[]
  ) => {
    setStrategies((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const newOnes = importedStrategies.filter((s) => !existingIds.has(s.id));
      return [...prev, ...newOnes];
    });
    setAssets((prev) => {
      const existingIds = new Set(prev.map((a) => a.id));
      const newOnes = importedAssets.filter((a) => !existingIds.has(a.id));
      return [...prev, ...newOnes];
    });
    if (importedTransactions) {
      setTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newOnes = importedTransactions.filter((t) => !existingIds.has(t.id));
        return [...prev, ...newOnes];
      });
    }
    if (importedSnapshots) {
      setSnapshots((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const newOnes = importedSnapshots.filter((s) => !existingIds.has(s.id));
        return [...prev, ...newOnes];
      });
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        hasCompletedOnboarding,
        completeOnboarding,
        strategies,
        activeStrategyId,
        activeStrategy,
        assets,
        activeAssets,
        transactions,
        snapshots,
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
        addTransaction,
        saveSnapshot,
        importData,
      }}
    >
      {/* suppressHydrationWarning evita erro quando o conteúdo difere entre SSR e CSR */}
      <div suppressHydrationWarning>
        {mounted ? children : (
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B0B14' }}>
            <div style={{ width: 32, height: 32, border: '2px solid #252538', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
