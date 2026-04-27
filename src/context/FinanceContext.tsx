'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { FinanceMonth, FinanceTransaction, FinanceCpfCnpj, FinancePaymentStatus, FinanceSection } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface FinanceContextType {
  months: FinanceMonth[];
  transactions: FinanceTransaction[];
  activeMonthId: string | null;

  setActiveMonthId: (id: string | null) => void;
  createMonth: (monthStr: string) => FinanceMonth;
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

const mapMonthFromDB = (m: any): FinanceMonth => ({
  id: m.id,
  month: m.month,
  createdAt: m.created_at,
  status: 'open',
  updatedAt: m.created_at,
});

const mapTxFromDB = (t: any): FinanceTransaction => ({
  id: t.id,
  monthId: t.month_id,
  type: t.type,
  section: t.section,
  description: t.description,
  value: Number(t.value),
  date: t.date,
  category: t.category,
  dueDay: t.due_day,
  cpfCnpj: t.cpf_cnpj as FinanceCpfCnpj,
  paymentStatus: t.payment_status as FinancePaymentStatus,
  card: t.card,
  createdAt: t.created_at,
});

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [months, setMonths] = useState<FinanceMonth[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [activeMonthId, setActiveMonthId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!user) {
      setMonths([]);
      setTransactions([]);
      setMounted(true);
      return;
    }

    const loadData = async () => {
      try {
        const { data: dbMonths, error: errMonths } = await supabase.from('finance_months').select('*').eq('user_id', user.id);
        if (errMonths) throw errMonths;
        
        const { data: dbTxs, error: errTxs } = await supabase.from('finance_transactions').select('*').eq('user_id', user.id);
        if (errTxs) throw errTxs;

        let finalMonths = dbMonths?.map(mapMonthFromDB) || [];
        let finalTxs = dbTxs?.map(mapTxFromDB) || [];

        // Migração do localStorage caso o Supabase esteja vazio (opcional)
        if (finalMonths.length === 0) {
           const storedMonths = localStorage.getItem(getStorageKey('months', user.id));
           const storedTxs = localStorage.getItem(getStorageKey('transactions', user.id));
           
           if (storedMonths) {
             const lsMonths: FinanceMonth[] = JSON.parse(storedMonths);
             const lsTxs: FinanceTransaction[] = storedTxs ? JSON.parse(storedTxs) : [];
             
             // Cria novos UUIDs válidos para evitar erro no Supabase
             const idMap = new Map<string, string>();
             
             const newMonths = lsMonths.map(m => {
               const newId = crypto.randomUUID();
               idMap.set(m.id, newId);
               return { ...m, id: newId };
             });

             const newTxs = lsTxs.map(t => ({
               ...t,
               id: crypto.randomUUID(),
               monthId: idMap.get(t.monthId) || t.monthId
             }));

             if (newMonths.length > 0) {
                await supabase.from('finance_months').insert(newMonths.map(m => ({
                  id: m.id,
                  user_id: user.id,
                  month: m.month,
                  created_at: m.createdAt,
                })));
                if (newTxs.length > 0) {
                   await supabase.from('finance_transactions').insert(newTxs.map(t => ({
                     id: t.id,
                     user_id: user.id,
                     month_id: t.monthId,
                     type: t.type,
                     section: t.section,
                     description: t.description,
                     value: t.value,
                     date: t.date,
                     category: t.category,
                     due_day: t.dueDay,
                     cpf_cnpj: t.cpfCnpj,
                     payment_status: t.paymentStatus,
                     card: t.card,
                     created_at: t.createdAt,
                   })));
                }
                
                finalMonths = newMonths;
                finalTxs = newTxs;
                localStorage.removeItem(getStorageKey('months', user.id));
                localStorage.removeItem(getStorageKey('transactions', user.id));
             }
           }
        }

        setMonths(finalMonths);
        setTransactions(finalTxs);
        
        const storedActive = localStorage.getItem(getStorageKey('activeMonthId', user.id));
        // Mapear o activeMonth caso tenha sido migrado (IDs mudaram)
        if (storedActive && finalMonths.some(m => m.id === storedActive)) {
          setActiveMonthId(storedActive);
        } else if (finalMonths.length > 0) {
          const sorted = [...finalMonths].sort((a, b) => b.month.localeCompare(a.month));
          setActiveMonthId(sorted[0].id);
        }
      } catch (err) {
        console.error('Erro carregando finanças do Supabase', err);
      }
      setMounted(true);
    };

    loadData();
  }, [user]);

  // Persiste a aba ativa localmente
  useEffect(() => {
    if (!mounted || !user) return;
    if (activeMonthId) {
      localStorage.setItem(getStorageKey('activeMonthId', user.id), activeMonthId);
    } else {
      localStorage.removeItem(getStorageKey('activeMonthId', user.id));
    }
  }, [activeMonthId, user, mounted]);

  const createMonth = useCallback((monthStr: string) => {
    if (!user) throw new Error("Usuário não autenticado");
    
    const now = new Date().toISOString();
    const newMonth: FinanceMonth = {
      id: crypto.randomUUID(),
      month: monthStr,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    
    setMonths(prev => {
      if (prev.some(m => m.month === monthStr)) return prev;
      return [...prev, newMonth];
    });
    setActiveMonthId(newMonth.id);

    // Persiste no Supabase
    supabase.from('finance_months').insert({
      id: newMonth.id,
      user_id: user.id,
      month: newMonth.month,
      created_at: newMonth.createdAt
    }).then(({error}) => {
      if (error) console.error("Erro criando mês", error);
    });

    return newMonth;
  }, [user]);

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

    // Remove do Supabase
    supabase.from('finance_months').delete().eq('id', id).then(({error}) => {
      if (error) console.error("Erro deletando mês", error);
    });
  }, [activeMonthId]);

  const addTransaction = useCallback((data: Omit<FinanceTransaction, 'id' | 'createdAt'>) => {
    if (!user) return;
    const now = new Date().toISOString();
    const newTx: FinanceTransaction = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
    };
    setTransactions(prev => [...prev, newTx]);

    // Persiste no Supabase
    supabase.from('finance_transactions').insert({
      id: newTx.id,
      user_id: user.id,
      month_id: newTx.monthId,
      type: newTx.type,
      section: newTx.section,
      description: newTx.description,
      value: newTx.value,
      date: newTx.date,
      category: newTx.category,
      due_day: newTx.dueDay,
      cpf_cnpj: newTx.cpfCnpj,
      payment_status: newTx.paymentStatus,
      card: newTx.card,
      created_at: newTx.createdAt
    }).then(({error}) => {
      if (error) console.error("Erro inserindo transação", error);
    });
  }, [user]);

  const updateTransaction = useCallback((id: string, data: Partial<FinanceTransaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));

    // Persiste no Supabase
    const updatePayload: any = {};
    if (data.type !== undefined) updatePayload.type = data.type;
    if (data.section !== undefined) updatePayload.section = data.section;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.value !== undefined) updatePayload.value = data.value;
    if (data.date !== undefined) updatePayload.date = data.date;
    if (data.category !== undefined) updatePayload.category = data.category;
    if (data.dueDay !== undefined) updatePayload.due_day = data.dueDay;
    if (data.cpfCnpj !== undefined) updatePayload.cpf_cnpj = data.cpfCnpj;
    if (data.paymentStatus !== undefined) updatePayload.payment_status = data.paymentStatus;
    if (data.card !== undefined) updatePayload.card = data.card;

    if (Object.keys(updatePayload).length > 0) {
      supabase.from('finance_transactions').update(updatePayload).eq('id', id).then(({error}) => {
        if (error) console.error("Erro atualizando transação", error);
      });
    }
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));

    // Persiste no Supabase
    supabase.from('finance_transactions').delete().eq('id', id).then(({error}) => {
      if (error) console.error("Erro deletando transação", error);
    });
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
