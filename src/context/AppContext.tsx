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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// ============================================
// Default Strategy (onboarding)
// ============================================

const DEFAULT_STRATEGY_ID = 'default-strategy';
const STATIC_DATE = '2026-01-01T00:00:00.000Z';

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
  dbSynced: boolean;

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
// LocalStorage helpers (fallback offline)
// ============================================

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function saveToStorage<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

// ============================================
// Supabase Helpers — converte snake_case ↔ camelCase
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbStrategyToApp(row: any, categories: StrategyCategory[]): Strategy {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    deviationTolerance: Number(row.deviation_tolerance),
    categories: categories.filter(c => c.strategyId === row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbCategoryToApp(row: any): StrategyCategory {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    className: row.class_name,
    subclassName: row.subclass_name,
    targetPercent: Number(row.target_percent),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbAssetToApp(row: any): Asset {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    categoryId: row.category_id,
    ticker: row.ticker,
    info: row.info ?? '',
    investedValue: Number(row.invested_value),
    currentValue: Number(row.current_value),
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbTransactionToApp(row: any): Transaction {
  return {
    id: row.id,
    assetId: row.asset_id,
    type: row.type,
    value: Number(row.value),
    quantity: row.quantity ? Number(row.quantity) : undefined,
    price: row.price ? Number(row.price) : undefined,
    notes: row.notes ?? '',
    date: row.date,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbSnapshotToApp(row: any): PortfolioSnapshot {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    date: row.date,
    totalValue: Number(row.total_value),
    totalInvested: Number(row.total_invested),
    profitLoss: Number(row.profit_loss),
  };
}

// ============================================
// Context
// ============================================

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const defaultStrategy = makeDefaultStrategy();

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([defaultStrategy]);
  const [activeStrategyId, setActiveStrategyId] = useState<string>(DEFAULT_STRATEGY_ID);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [mounted, setMounted] = useState(false);
  const [dbSynced, setDbSynced] = useState(false);

  // ============================================
  // Carrega do localStorage primeiro (evita flash)
  // ============================================
  useEffect(() => {
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

  // ============================================
  // Quando usuário autentica → sincroniza com Supabase
  // ============================================
  useEffect(() => {
    if (!user || !mounted) return;

    async function syncFromDB() {
      const userId = user!.id;

      // Busca estratégias
      const { data: strRows, error: strErr } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at');

      if (strErr) { console.error('Erro ao carregar estratégias:', strErr); return; }

      // Busca categorias
      const { data: catRows } = await supabase
        .from('strategy_categories')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order');

      // Busca ativos
      const { data: assetRows } = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', userId);

      // Busca transações
      const { data: txRows } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      // Busca snapshots
      const { data: snapRows } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', userId);

      const appCategories = (catRows ?? []).map(dbCategoryToApp);
      const appAssets = (assetRows ?? []).map(dbAssetToApp);
      const appTransactions = (txRows ?? []).map(dbTransactionToApp);
      const appSnapshots = (snapRows ?? []).map(dbSnapshotToApp);

      if ((strRows ?? []).length > 0) {
        // Usuário tem dados no banco — usa eles como fonte de verdade
        const appStrategies = (strRows ?? []).map(r => dbStrategyToApp(r, appCategories));
        const firstId = appStrategies[0].id;

        setStrategies(appStrategies);
        setActiveStrategyId(loadFromStorage<string>('investmap_active', firstId));
        setAssets(appAssets);
        setTransactions(appTransactions);
        setSnapshots(appSnapshots);
        setHasCompletedOnboarding(true);
        saveToStorage('investmap_onboarding', true);
      } else {
        // Usuário novo — verifica se tem dados locais para migrar
        const localStrategies = loadFromStorage<Strategy[]>('investmap_strategies', []);
        const localAssets = loadFromStorage<Asset[]>('investmap_assets', []);
        const hasRealData = localStrategies.some(s => s.id !== DEFAULT_STRATEGY_ID) || localAssets.length > 0;

        if (hasRealData) {
          // Migra dados locais para o banco
          await migrateLocalDataToDB(userId, localStrategies, localAssets);
        }
      }

      setDbSynced(true);
    }

    syncFromDB();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mounted]);

  // ============================================
  // Migração: localStorage → Supabase (primeira vez)
  // ============================================
  async function migrateLocalDataToDB(userId: string, localStrategies: Strategy[], localAssets: Asset[]) {
    for (const s of localStrategies) {
      await supabase.from('strategies').upsert({
        id: s.id,
        user_id: userId,
        name: s.name,
        description: s.description ?? '',
        deviation_tolerance: s.deviationTolerance,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
      });

      for (let i = 0; i < s.categories.length; i++) {
        const c = s.categories[i];
        await supabase.from('strategy_categories').upsert({
          id: c.id,
          strategy_id: s.id,
          user_id: userId,
          class_name: c.className,
          subclass_name: c.subclassName,
          target_percent: c.targetPercent,
          sort_order: i,
        });
      }
    }

    for (const a of localAssets) {
      await supabase.from('assets').upsert({
        id: a.id,
        strategy_id: a.strategyId,
        category_id: a.categoryId,
        user_id: userId,
        ticker: a.ticker,
        info: a.info ?? '',
        invested_value: a.investedValue,
        current_value: a.currentValue,
        updated_at: a.updatedAt,
      });
    }
  }

  // ============================================
  // Persiste localStorage (offline fallback)
  // ============================================
  useEffect(() => { if (mounted) saveToStorage('investmap_onboarding', hasCompletedOnboarding); }, [hasCompletedOnboarding, mounted]);
  useEffect(() => { if (mounted) saveToStorage('investmap_strategies', strategies); }, [strategies, mounted]);
  useEffect(() => { if (mounted) saveToStorage('investmap_active', activeStrategyId); }, [activeStrategyId, mounted]);
  useEffect(() => { if (mounted) saveToStorage('investmap_assets', assets); }, [assets, mounted]);
  useEffect(() => { if (mounted) saveToStorage('investmap_transactions', transactions); }, [transactions, mounted]);
  useEffect(() => { if (mounted) saveToStorage('investmap_snapshots', snapshots); }, [snapshots, mounted]);

  const activeStrategy = strategies.find((s) => s.id === activeStrategyId) ?? null;
  const activeAssets = assets.filter((a) => a.strategyId === activeStrategyId);

  // ============================================
  // Onboarding
  // ============================================
  const completeOnboarding = useCallback(async (categories: Omit<StrategyCategory, 'id' | 'strategyId'>[]) => {
    const newCats: StrategyCategory[] = categories.map((c, i) => ({
      ...c,
      id: generateId(),
      strategyId: activeStrategyId,
    }));

    setStrategies((prev) =>
      prev.map((s) =>
        s.id === activeStrategyId
          ? { ...s, categories: newCats, updatedAt: new Date().toISOString() }
          : s
      )
    );
    setHasCompletedOnboarding(true);

    // Persiste no banco se autenticado
    if (user) {
      const strat = strategies.find(s => s.id === activeStrategyId);
      if (strat) {
        await supabase.from('strategies').upsert({
          id: strat.id,
          user_id: user.id,
          name: strat.name,
          description: strat.description ?? '',
          deviation_tolerance: strat.deviationTolerance,
          created_at: strat.createdAt,
          updated_at: new Date().toISOString(),
        });
      }
      for (let i = 0; i < newCats.length; i++) {
        const c = newCats[i];
        await supabase.from('strategy_categories').upsert({
          id: c.id,
          strategy_id: activeStrategyId,
          user_id: user.id,
          class_name: c.className,
          subclass_name: c.subclassName,
          target_percent: c.targetPercent,
          sort_order: i,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStrategyId, user, strategies]);

  // ============================================
  // Strategy CRUD
  // ============================================
  const createStrategy = useCallback((data: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt' | 'categories'>): Strategy => {
    const now = new Date().toISOString();
    const newStrategy: Strategy = { ...data, id: generateId(), categories: [], createdAt: now, updatedAt: now };
    setStrategies((prev) => [...prev, newStrategy]);

    if (user) {
      supabase.from('strategies').insert({
        id: newStrategy.id,
        user_id: user.id,
        name: newStrategy.name,
        description: newStrategy.description ?? '',
        deviation_tolerance: newStrategy.deviationTolerance,
        created_at: now,
        updated_at: now,
      }).then(({ error }) => { if (error) console.error(error); });
    }
    return newStrategy;
  }, [user]);

  const updateStrategy = useCallback((id: string, data: Partial<Strategy>) => {
    const now = new Date().toISOString();
    setStrategies((prev) => prev.map((s) => s.id === id ? { ...s, ...data, updatedAt: now } : s));

    if (user) {
      supabase.from('strategies').update({
        name: data.name,
        description: data.description,
        deviation_tolerance: data.deviationTolerance,
        updated_at: now,
      }).eq('id', id).eq('user_id', user.id)
        .then(({ error }) => { if (error) console.error(error); });
    }
  }, [user]);

  const deleteStrategy = useCallback((id: string) => {
    setStrategies((prev) => prev.filter((s) => s.id !== id));
    setAssets((prev) => prev.filter((a) => a.strategyId !== id));

    if (user) {
      supabase.from('strategies').delete().eq('id', id).eq('user_id', user.id)
        .then(({ error }) => { if (error) console.error(error); });
    }
  }, [user]);

  const setActiveStrategy = useCallback((id: string) => { setActiveStrategyId(id); }, []);

  // ============================================
  // Category CRUD
  // ============================================
  const addCategory = useCallback((data: Omit<StrategyCategory, 'id' | 'strategyId'>) => {
    const newCat: StrategyCategory = { ...data, id: generateId(), strategyId: activeStrategyId };
    setStrategies((prev) => prev.map((s) =>
      s.id === activeStrategyId
        ? { ...s, categories: [...s.categories, newCat], updatedAt: new Date().toISOString() }
        : s
    ));

    if (user) {
      supabase.from('strategy_categories').insert({
        id: newCat.id,
        strategy_id: activeStrategyId,
        user_id: user.id,
        class_name: newCat.className,
        subclass_name: newCat.subclassName,
        target_percent: newCat.targetPercent,
        sort_order: 99,
      }).then(({ error }) => { if (error) console.error(error); });
    }
  }, [activeStrategyId, user]);

  const updateCategory = useCallback((id: string, data: Partial<StrategyCategory>) => {
    setStrategies((prev) => prev.map((s) =>
      s.id === activeStrategyId
        ? { ...s, categories: s.categories.map((c) => c.id === id ? { ...c, ...data } : c), updatedAt: new Date().toISOString() }
        : s
    ));

    if (user) {
      supabase.from('strategy_categories').update({
        class_name: data.className,
        subclass_name: data.subclassName,
        target_percent: data.targetPercent,
      }).eq('id', id).eq('user_id', user.id)
        .then(({ error }) => { if (error) console.error(error); });
    }
  }, [activeStrategyId, user]);

  const deleteCategory = useCallback((id: string) => {
    setStrategies((prev) => prev.map((s) =>
      s.id === activeStrategyId
        ? { ...s, categories: s.categories.filter((c) => c.id !== id), updatedAt: new Date().toISOString() }
        : s
    ));
    setAssets((prev) => prev.filter((a) => a.categoryId !== id));

    if (user) {
      supabase.from('strategy_categories').delete().eq('id', id).eq('user_id', user.id)
        .then(({ error }) => { if (error) console.error(error); });
    }
  }, [activeStrategyId, user]);

  // ============================================
  // Asset CRUD
  // ============================================
  const addAsset = useCallback((data: Omit<Asset, 'id' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newAsset: Asset = { ...data, id: generateId(), updatedAt: now };
    setAssets((prev) => [...prev, newAsset]);

    // Primeira transação automática
    const firstTx: Transaction = { id: generateId(), assetId: newAsset.id, type: 'buy', value: newAsset.investedValue, date: now };
    setTransactions((prev) => [...prev, firstTx]);

    if (user) {
      supabase.from('assets').insert({
        id: newAsset.id,
        strategy_id: newAsset.strategyId,
        category_id: newAsset.categoryId,
        user_id: user.id,
        ticker: newAsset.ticker,
        info: newAsset.info ?? '',
        invested_value: newAsset.investedValue,
        current_value: newAsset.currentValue,
        updated_at: now,
      }).then(({ error }) => { if (error) console.error(error); });

      supabase.from('transactions').insert({
        id: firstTx.id,
        asset_id: firstTx.assetId,
        user_id: user.id,
        type: 'buy',
        value: firstTx.value,
        date: now,
      }).then(({ error }) => { if (error) console.error(error); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const updateAsset = useCallback((id: string, data: Partial<Asset>) => {
    const now = new Date().toISOString();
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, ...data, updatedAt: now } : a));

    if (user) {
      supabase.from('assets').update({
        ticker: data.ticker,
        info: data.info,
        category_id: data.categoryId,
        invested_value: data.investedValue,
        current_value: data.currentValue,
        updated_at: now,
      }).eq('id', id).eq('user_id', user.id)
        .then(({ error }) => { if (error) console.error(error); });
    }
  }, [user]);

  const deleteAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setTransactions((prev) => prev.filter((t) => t.assetId !== id));

    if (user) {
      supabase.from('assets').delete().eq('id', id).eq('user_id', user.id)
        .then(({ error }) => { if (error) console.error(error); });
    }
  }, [user]);

  // ============================================
  // Transaction
  // ============================================
  const addTransaction = useCallback((data: Omit<Transaction, 'id' | 'date'>) => {
    const now = new Date().toISOString();
    const newTx: Transaction = { ...data, id: generateId(), date: now };
    setTransactions((prev) => [...prev, newTx]);

    if (user) {
      supabase.from('transactions').insert({
        id: newTx.id,
        asset_id: newTx.assetId,
        user_id: user.id,
        type: newTx.type,
        value: newTx.value,
        quantity: newTx.quantity ?? null,
        price: newTx.price ?? null,
        notes: newTx.notes ?? '',
        date: now,
      }).then(({ error }) => { if (error) console.error(error); });
    }
  }, [user]);

  // ============================================
  // Snapshot
  // ============================================
  const saveSnapshot = useCallback((data: Omit<PortfolioSnapshot, 'id'>) => {
    const newSnap: PortfolioSnapshot = { ...data, id: generateId() };
    setSnapshots((prev) => {
      const existingIndex = prev.findIndex(s => s.strategyId === data.strategyId && s.date === data.date);
      if (existingIndex >= 0) {
        const arr = [...prev];
        arr[existingIndex] = { ...arr[existingIndex], ...newSnap };
        return arr;
      }
      return [...prev, newSnap];
    });

    if (user) {
      supabase.from('portfolio_snapshots').upsert({
        id: newSnap.id,
        strategy_id: newSnap.strategyId,
        user_id: user.id,
        date: newSnap.date,
        total_value: newSnap.totalValue,
        total_invested: newSnap.totalInvested,
        profit_loss: newSnap.profitLoss,
      }, { onConflict: 'strategy_id,date' })
        .then(({ error }) => { if (error) console.error(error); });
    }
  }, [user]);

  // ============================================
  // Import
  // ============================================
  const importData = useCallback((
    importedStrategies: Strategy[],
    importedAssets: Asset[],
    importedTransactions?: Transaction[],
    importedSnapshots?: PortfolioSnapshot[]
  ) => {
    setStrategies((prev) => {
      const ids = new Set(prev.map(s => s.id));
      return [...prev, ...importedStrategies.filter(s => !ids.has(s.id))];
    });
    setAssets((prev) => {
      const ids = new Set(prev.map(a => a.id));
      return [...prev, ...importedAssets.filter(a => !ids.has(a.id))];
    });
    if (importedTransactions) {
      setTransactions((prev) => {
        const ids = new Set(prev.map(t => t.id));
        return [...prev, ...importedTransactions.filter(t => !ids.has(t.id))];
      });
    }
    if (importedSnapshots) {
      setSnapshots((prev) => {
        const ids = new Set(prev.map(s => s.id));
        return [...prev, ...importedSnapshots.filter(s => !ids.has(s.id))];
      });
    }
  }, []);

  return (
    <AppContext.Provider value={{
      hasCompletedOnboarding,
      completeOnboarding,
      strategies,
      activeStrategyId,
      activeStrategy,
      assets,
      activeAssets,
      transactions,
      snapshots,
      dbSynced,
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
    }}>
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
