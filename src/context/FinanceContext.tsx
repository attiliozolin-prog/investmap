'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { FinanceMonth, FinanceTransaction, FinanceCpfCnpj, FinancePaymentStatus, FinanceSection, FinanceCategory, FinanceSubscription } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { reportSyncError } from '@/lib/syncStatus';

interface FinanceContextType {
  months: FinanceMonth[];
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  subscriptions: FinanceSubscription[];
  activeMonthId: string | null;

  setActiveMonthId: (id: string | null) => void;
  createMonth: (monthStr: string) => FinanceMonth;
  closeMonth: (id: string) => void;
  reopenMonth: (id: string) => void;
  deleteMonth: (id: string) => void;

  addTransaction: (data: Omit<FinanceTransaction, 'id' | 'createdAt'>) => void;
  updateTransaction: (id: string, data: Partial<FinanceTransaction>) => void;
  deleteTransaction: (id: string) => void;

  addCategory: (name: string) => void;
  updateCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;

  addSubscription: (data: Omit<FinanceSubscription, 'id' | 'createdAt'>) => void;
  updateSubscription: (id: string, data: Partial<FinanceSubscription>) => void;
  deleteSubscription: (id: string) => void;
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
  status: (m.status as FinanceMonth['status']) ?? 'open',
  updatedAt: m.updated_at ?? m.created_at,
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

const mapCategoryFromDB = (c: any): FinanceCategory => ({
  id: c.id,
  name: c.name,
});

const mapSubscriptionFromDB = (s: any): FinanceSubscription => ({
  id: s.id,
  description: s.description,
  category: s.category,
  value: Number(s.value),
  createdAt: s.created_at,
});

export const DEFAULT_CATEGORIES = [
  'Sobrevivência','Cartão Crédito','Telefonia','Esporte','Energia',
  'Limpeza e Manutenção','Saúde','Contabilidade','Impostos','Lazer',
  'Alimentação','Transporte','Vestuário','Compras Online','Pets','Beleza',
  'Casa','Educação','Outro'
];

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [months, setMonths] = useState<FinanceMonth[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [subscriptions, setSubscriptions] = useState<FinanceSubscription[]>([]);
  const [activeMonthId, setActiveMonthId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!user) {
      setMonths([]);
      setTransactions([]);
      setCategories([]);
      setSubscriptions([]);
      setMounted(true);
      return;
    }

    const loadData = async () => {
      try {
        const { data: dbMonths, error: errMonths } = await supabase.from('finance_months').select('*').eq('user_id', user.id);
        if (errMonths) throw errMonths;

        const { data: dbTxs, error: errTxs } = await supabase.from('finance_transactions').select('*').eq('user_id', user.id);
        if (errTxs) throw errTxs;

        const { data: dbCats, error: errCats } = await supabase.from('finance_categories').select('*').eq('user_id', user.id);
        if (errCats) throw errCats;

        const { data: dbSubs, error: errSubs } = await supabase.from('finance_subscriptions').select('*').eq('user_id', user.id);
        // Tabela nova/opcional: se ainda não foi criada no banco (usuário não
        // rodou a migração), degrada graciosamente em vez de quebrar o app.
        if (errSubs) console.warn('finance_subscriptions indisponível (rode a migração SQL):', errSubs.message);

        let finalMonths = dbMonths?.map(mapMonthFromDB) || [];
        let finalTxs = dbTxs?.map(mapTxFromDB) || [];
        let finalCats = dbCats?.map(mapCategoryFromDB) || [];
        let finalSubs = dbSubs?.map(mapSubscriptionFromDB) || [];

        // ── Migração única: assinaturas antigas (lançamentos mensais com
        // section='assinatura') viram assinaturas GLOBAIS. Não apaga as
        // linhas antigas — só copia, deduplicando por descrição, a partir
        // do mês mais recente que tiver alguma. Roda uma única vez porque
        // condicionamos em finalSubs.length === 0.
        if (finalSubs.length === 0 && !errSubs) {
          const legacySubTxs = finalTxs.filter(t => t.section === 'assinatura');
          if (legacySubTxs.length > 0) {
            const mostRecentMonthId = [...finalMonths]
              .sort((a, b) => b.month.localeCompare(a.month))[0]?.id;
            const fromLatest = legacySubTxs.filter(t => t.monthId === mostRecentMonthId);
            const source = fromLatest.length > 0 ? fromLatest : legacySubTxs;

            const seen = new Set<string>();
            const toMigrate = source.filter(t => {
              const key = t.description.trim().toLowerCase();
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

            const newSubs: FinanceSubscription[] = toMigrate.map(t => ({
              id: crypto.randomUUID(),
              description: t.description,
              category: t.category,
              value: t.value,
              createdAt: new Date().toISOString(),
            }));

            if (newSubs.length > 0) {
              const { error: errMigrate } = await supabase.from('finance_subscriptions').insert(
                newSubs.map(s => ({ id: s.id, user_id: user.id, description: s.description, category: s.category, value: s.value, created_at: s.createdAt }))
              );
              if (!errMigrate) finalSubs = newSubs;
              else console.warn('Migração de assinaturas falhou:', errMigrate.message);
            }
          }
        }

        // Inicializar categorias padrão se o usuário não tiver nenhuma
        if (finalCats.length === 0) {
          const newCats = DEFAULT_CATEGORIES.map(name => ({ id: crypto.randomUUID(), name }));
          await supabase.from('finance_categories').insert(newCats.map(c => ({ id: c.id, user_id: user.id, name: c.name })));
          finalCats = newCats;
        }

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
        setCategories(finalCats);
        setSubscriptions(finalSubs);

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
      if (error) reportSyncError("Erro criando mês", error);
    });

    return newMonth;
  }, [user]);

  // NOTA: closeMonth/reopenMonth exigem a coluna "status" em finance_months
  // (ver migração SQL em scripts/create_finance_subscriptions.sql). Sem ela,
  // o update falha silenciosamente no servidor mas o estado local não reverte
  // — o mês aparece fechado na UI até a próxima sincronização. Rode a
  // migração para persistência real.
  const closeMonth = useCallback((id: string) => {
    const now = new Date().toISOString();
    setMonths(prev => prev.map(m => m.id === id ? { ...m, status: 'closed', updatedAt: now } : m));
    supabase.from('finance_months').update({ status: 'closed', updated_at: now }).eq('id', id).then(({ error }) => {
      if (error) reportSyncError('Erro fechando mês', error);
    });
  }, []);

  const reopenMonth = useCallback((id: string) => {
    const now = new Date().toISOString();
    setMonths(prev => prev.map(m => m.id === id ? { ...m, status: 'open', updatedAt: now } : m));
    supabase.from('finance_months').update({ status: 'open', updated_at: now }).eq('id', id).then(({ error }) => {
      if (error) reportSyncError('Erro reabrindo mês', error);
    });
  }, []);

  const deleteMonth = useCallback((id: string) => {
    setMonths(prev => prev.filter(m => m.id !== id));
    setTransactions(prev => prev.filter(t => t.monthId !== id));
    if (activeMonthId === id) setActiveMonthId(null);

    // Remove do Supabase
    supabase.from('finance_months').delete().eq('id', id).then(({error}) => {
      if (error) reportSyncError("Erro deletando mês", error);
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
      if (error) reportSyncError("Erro inserindo transação", error);
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
        if (error) reportSyncError("Erro atualizando transação", error);
      });
    }
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));

    // Persiste no Supabase
    supabase.from('finance_transactions').delete().eq('id', id).then(({error}) => {
      if (error) reportSyncError("Erro deletando transação", error);
    });
  }, []);

  const addCategory = useCallback((name: string) => {
    if (!user) return;
    const newCat = { id: crypto.randomUUID(), name };
    setCategories(prev => [...prev, newCat]);
    supabase.from('finance_categories').insert({ id: newCat.id, user_id: user.id, name }).then(({error}) => {
      if (error) reportSyncError("Erro inserindo categoria", error);
    });
  }, [user]);

  const updateCategory = useCallback((id: string, name: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    supabase.from('finance_categories').update({ name }).eq('id', id).then(({error}) => {
      if (error) reportSyncError("Erro atualizando categoria", error);
    });
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    supabase.from('finance_categories').delete().eq('id', id).then(({error}) => {
      if (error) reportSyncError("Erro deletando categoria", error);
    });
  }, []);

  // Assinaturas são globais (não pertencem a um FinanceMonth) — por isso
  // "persistem" automaticamente em todos os meses até serem adicionadas/removidas.
  const addSubscription = useCallback((data: Omit<FinanceSubscription, 'id' | 'createdAt'>) => {
    if (!user) return;
    const now = new Date().toISOString();
    const newSub: FinanceSubscription = { ...data, id: crypto.randomUUID(), createdAt: now };
    setSubscriptions(prev => [...prev, newSub]);
    supabase.from('finance_subscriptions').insert({
      id: newSub.id, user_id: user.id, description: newSub.description,
      category: newSub.category, value: newSub.value, created_at: now,
    }).then(({ error }) => {
      if (error) reportSyncError('Erro inserindo assinatura', error);
    });
  }, [user]);

  const updateSubscription = useCallback((id: string, data: Partial<FinanceSubscription>) => {
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));

    const updatePayload: any = {};
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.category !== undefined) updatePayload.category = data.category;
    if (data.value !== undefined) updatePayload.value = data.value;

    if (Object.keys(updatePayload).length > 0) {
      supabase.from('finance_subscriptions').update(updatePayload).eq('id', id).then(({ error }) => {
        if (error) reportSyncError('Erro atualizando assinatura', error);
      });
    }
  }, []);

  const deleteSubscription = useCallback((id: string) => {
    setSubscriptions(prev => prev.filter(s => s.id !== id));
    supabase.from('finance_subscriptions').delete().eq('id', id).then(({ error }) => {
      if (error) reportSyncError('Erro removendo assinatura', error);
    });
  }, []);

  const contextValue = useMemo(() => ({
    months,
    transactions,
    categories,
    subscriptions,
    activeMonthId,
    setActiveMonthId,
    createMonth,
    closeMonth,
    reopenMonth,
    deleteMonth,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    addSubscription,
    updateSubscription,
    deleteSubscription,
  }), [
    months, transactions, categories, subscriptions, activeMonthId,
    setActiveMonthId, createMonth, closeMonth, reopenMonth, deleteMonth,
    addTransaction, updateTransaction, deleteTransaction,
    addCategory, updateCategory, deleteCategory,
    addSubscription, updateSubscription, deleteSubscription,
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
