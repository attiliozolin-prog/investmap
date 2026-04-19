'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { FinanceMonth, FinanceTransaction, FinanceTransactionType, FinanceTransactionCategory } from '@/types';
import { generateId } from '@/lib/calculations';
import { useAuth } from '@/context/AuthContext';

interface FinanceContextType {
  months: FinanceMonth[];
  transactions: FinanceTransaction[];
  activeMonthId: string | null;
  
  setActiveMonthId: (id: string | null) => void;
  createMonth: (monthStr: string) => FinanceMonth; // 'YYYY-MM'
  closeMonth: (id: string) => void;
  reopenMonth: (id: string) => void;
  deleteMonth: (id: string) => void;

  addTransaction: (data: Omit<FinanceTransaction, 'id' | 'createdAt'>) => void;
  updateTransaction: (id: string, data: Partial<FinanceTransaction>) => void;
  deleteTransaction: (id: string) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

function getStorageKey(key: string, userId?: string): string {
  const prefix = userId ? `finance_u_${userId}` : 'finance_guest';
  return `${prefix}_${key}`;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  const [months, setMonths] = useState<FinanceMonth[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [activeMonthId, setActiveMonthId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Carrega do LocalStorage na montagem / mudança de usuário
  useEffect(() => {
    const userId = user?.id; // se undefined, cai pra guest
    try {
      const storedMonths = localStorage.getItem(getStorageKey('months', userId));
      const storedTxs = localStorage.getItem(getStorageKey('transactions', userId));
      const storedActive = localStorage.getItem(getStorageKey('activeMonthId', userId));

      const parsedMonths: FinanceMonth[] = storedMonths ? JSON.parse(storedMonths) : [];
      setMonths(parsedMonths);
      setTransactions(storedTxs ? JSON.parse(storedTxs) : []);
      
      if (storedActive && parsedMonths.some(m => m.id === storedActive)) {
        setActiveMonthId(storedActive);
      } else if (parsedMonths.length > 0) {
        // Pega o mês mais recente (ordem alfabética/numérica do mês 'YYYY-MM')
        const sorted = [...parsedMonths].sort((a, b) => b.month.localeCompare(a.month));
        setActiveMonthId(sorted[0].id);
      } else {
        setActiveMonthId(null);
      }
    } catch (e) {
      console.error("Erro carregando finanças", e);
    }
    setMounted(true);
  }, [user]);

  // Persiste no LocalStorage a cada mudança
  useEffect(() => {
    if (!mounted) return;
    const userId = user?.id;
    localStorage.setItem(getStorageKey('months', userId), JSON.stringify(months));
    localStorage.setItem(getStorageKey('transactions', userId), JSON.stringify(transactions));
    if (activeMonthId) {
      localStorage.setItem(getStorageKey('activeMonthId', userId), activeMonthId);
    } else {
      localStorage.removeItem(getStorageKey('activeMonthId', userId));
    }
  }, [months, transactions, activeMonthId, user, mounted]);

  // ===================================
  // CRUD Months
  // ===================================
  const createMonth = useCallback((monthStr: string) => {
    const now = new Date().toISOString();
    const newMonth: FinanceMonth = {
      id: generateId(),
      month: monthStr,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    setMonths(prev => {
      // evita duplicados
      if (prev.some(m => m.month === monthStr)) return prev;
      return [...prev, newMonth];
    });
    setActiveMonthId(newMonth.id);
    return newMonth;
  }, []);

  const closeMonth = useCallback((id: string) => {
    setMonths(prev => prev.map(m => m.id === id ? { ...m, status: 'closed', updatedAt: new Date().toISOString() } : m));
  }, []);

  const reopenMonth = useCallback((id: string) => {
    setMonths(prev => prev.map(m => m.id === id ? { ...m, status: 'open', updatedAt: new Date().toISOString() } : m));
  }, []);

  const deleteMonth = useCallback((id: string) => {
    setMonths(prev => prev.filter(m => m.id !== id));
    setTransactions(prev => prev.filter(t => t.monthId !== id));
    if (activeMonthId === id) setActiveMonthId(null);
  }, [activeMonthId]);

  // ===================================
  // CRUD Transactions
  // ===================================
  const addTransaction = useCallback((data: Omit<FinanceTransaction, 'id' | 'createdAt'>) => {
    const newTx: FinanceTransaction = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setTransactions(prev => [...prev, newTx]);
  }, []);

  const updateTransaction = useCallback((id: string, data: Partial<FinanceTransaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const contextValue = useMemo(() => ({
    months,
    transactions,
    activeMonthId,
    setActiveMonthId,
    createMonth,
    closeMonth,
    reopenMonth,
    deleteMonth,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  }), [
    months, transactions, activeMonthId,
    setActiveMonthId, createMonth, closeMonth, reopenMonth, deleteMonth,
    addTransaction, updateTransaction, deleteTransaction
  ]);

  return (
    <FinanceContext.Provider value={contextValue}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance deve ser usado dentro de um FinanceProvider');
  }
  return context;
}
