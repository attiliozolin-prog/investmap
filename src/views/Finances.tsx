'use client';

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useApp } from '@/context/AppContext';
import { FinanceTransactionType, FinanceTransactionCategory } from '@/types';
import { Plus, Trash2, X, Wallet, TrendingDown, Clock, ShieldAlert } from 'lucide-react';
import styles from './Finances.module.css';

export default function Finances({ onNavigate }: { onNavigate?: (t: string) => void }) {
  const { 
    months, 
    transactions, 
    activeMonthId, 
    setActiveMonthId, 
    createMonth, 
    addTransaction, 
    deleteTransaction 
  } = useFinance();

  const { assets } = useApp();

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);

  // Month selector logic
  const activeMonth = useMemo(() => months.find(m => m.id === activeMonthId), [months, activeMonthId]);
  
  // Sort months by name descending
  const sortedMonths = useMemo(() => [...months].sort((a,b) => b.month.localeCompare(a.month)), [months]);

  // Current month's transactions
  const monthTxs = useMemo(() => 
    transactions.filter(t => t.monthId === activeMonthId)
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [transactions, activeMonthId]);

  // Calcs
  const summary = useMemo(() => {
    let income = 0;
    let fixedExp = 0;
    let varExp = 0;
    let subExp = 0;

    monthTxs.forEach(t => {
      if (t.type === 'income') income += t.value;
      else {
        if (t.category === 'Fixo') fixedExp += t.value;
        else if (t.category === 'Variável') varExp += t.value;
        else if (t.category === 'Assinatura') subExp += t.value;
      }
    });

    const totalExp = fixedExp + varExp + subExp;
    return {
      income,
      fixedExp,
      varExp,
      subExp,
      totalExp,
      balance: income - totalExp
    };
  }, [monthTxs]);

  // Survival Time Calc
  // Somar o total atual dos ativos de investimento
  const totalInvestmentsValue = useMemo(() => 
    assets.reduce((acc, asset) => acc + asset.currentValue, 0),
  [assets]);

  const survivalMonths = summary.totalExp > 0 ? (totalInvestmentsValue / summary.totalExp) : 0;

  // Formatadores
  const formatMoney = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    // Ajuste fuso (gambiarra rápida para UTC dates)
    const dt = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return dt.toLocaleDateString('pt-BR');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.title}>
          <Wallet className="text-primary" /> Controle Financeiro
        </div>
        
        <div className={styles.monthSelector}>
          <select 
            className={styles.monthSelect} 
            value={activeMonthId || ''} 
            onChange={(e) => setActiveMonthId(e.target.value)}
          >
            {sortedMonths.length === 0 && <option value="">Nenhum mês</option>}
            {sortedMonths.map(m => (
              <option key={m.id} value={m.id}>
                {m.month}
              </option>
            ))}
          </select>
          <button className={styles.actionBtn} onClick={() => setIsMonthModalOpen(true)} title="Novo Mês">
            <Plus size={16} />
          </button>
        </div>
      </header>

      {activeMonth ? (
        <>
          <div className={styles.summaryGrid}>
            <div className={`${styles.card} ${styles.incomeCard}`}>
              <div className={styles.cardTitle}>Entradas do Mês</div>
              <div className={styles.cardValue}>{formatMoney(summary.income)}</div>
            </div>
            <div className={`${styles.card} ${styles.expenseFixedCard}`}>
              <div className={styles.cardTitle}>Despesas Fixas & Assinaturas</div>
              <div className={styles.cardValue}>{formatMoney(summary.fixedExp + summary.subExp)}</div>
            </div>
            <div className={`${styles.card} ${styles.expenseVariableCard}`}>
              <div className={styles.cardTitle}>Despesas Variáveis</div>
              <div className={styles.cardValue}>{formatMoney(summary.varExp)}</div>
            </div>
            <div className={`${styles.card} ${styles.balanceCard}`}>
              <div className={styles.cardTitle}>Sobra para Investir</div>
              <div className={styles.cardValue}>{formatMoney(summary.balance)}</div>
            </div>
            
            {/* Sobrevivência */}
            <div className={`${styles.card} ${styles.survivalCard}`}>
              <div>
                <div className={`${styles.cardTitle} ${styles.survivalTitle}`}>
                  <ShieldAlert size={20}/> Tempo Atual de Sobrevivência
                </div>
                <div className={styles.survivalDesc}>
                  Com o seu custo mensal atual ({formatMoney(summary.totalExp)}) e seu 
                  patrimônio investido ({formatMoney(totalInvestmentsValue)}), por quantos meses você sobreviveria?
                </div>
              </div>
              <div className={styles.survivalValue}>
                {survivalMonths > 0 ? `${survivalMonths.toFixed(1)} meses` : 'N/A'}
              </div>
            </div>
          </div>

          <div className={styles.tableSection}>
            <div className={styles.tableHeader}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Lançamentos de {activeMonth.month}</h3>
              <button className={styles.actionBtn} onClick={() => setIsTxModalOpen(true)}>
                <Plus size={16} /> Nova Movimentação
              </button>
            </div>
            <div className={styles.tableContainer}>
              {monthTxs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Nenhum lançamento registrado neste mês.
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Tipo</th>
                      <th>Categoria</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthTxs.map(tx => (
                      <tr key={tx.id}>
                        <td>{formatDate(tx.date)}</td>
                        <td style={{ fontWeight: 500 }}>{tx.description}</td>
                        <td>
                          <span className={`${styles.typeLabel} ${tx.type === 'income' ? styles.incomeType : styles.expenseType}`}>
                            {tx.type === 'income' ? <TrendingDown size={14} style={{ transform: 'rotate(180deg)' }} /> : <TrendingDown size={14} />}
                            {tx.type === 'income' ? 'Receita' : 'Despesa'}
                          </span>
                        </td>
                        <td>
                          {tx.type === 'expense' ? (
                            <span className={`${styles.categoryTag} ${
                              tx.category === 'Fixo' ? styles.catFixo : 
                              tx.category === 'Variável' ? styles.catVariavel : styles.catAssinatura
                            }`}>
                              {tx.category}
                            </span>
                          ) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: tx.type === 'income' ? '#10B981' : 'inherit' }}>
                          {tx.type === 'expense' ? '-' : '+'}{formatMoney(tx.value)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className={styles.delBtn} 
                            onClick={() => { if(confirm('Apagar lançamento?')) deleteTransaction(tx.id); }}
                            title="Apagar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--card-bg)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
          <Clock size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
          <h2>Nenhum mês de controle criado</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Inicie seu controle financeiro criando um mês para registrar entradas e saídas.
          </p>
          <button className={styles.actionBtn} style={{ margin: '0 auto' }} onClick={() => setIsMonthModalOpen(true)}>
            <Plus size={18} /> Criar Primeiro Mês
          </button>
        </div>
      )}

      {/* MODAL MÊS */}
      {isMonthModalOpen && (
       <MonthModal 
         onClose={() => setIsMonthModalOpen(false)} 
         onCreate={(v) => { createMonth(v); setIsMonthModalOpen(false); }} 
       /> 
      )}

      {/* MODAL TX */}
      {isTxModalOpen && activeMonthId && (
        <TxModal 
          activeMonthId={activeMonthId}
          onClose={() => setIsTxModalOpen(false)}
          onAdd={addTransaction}
        />
      )}
    </div>
  );
}

// ============================================
// MODALS EMBUTIDOS (Para refatoração depois se crescerem)
// ============================================

function MonthModal({ onClose, onCreate }: { onClose: () => void, onCreate: (val: string) => void }) {
  const [val, setVal] = useState('');
  
  // Seta default para o mês atual YYYY-MM
  React.useEffect(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    setVal(`${d.getFullYear()}-${mm}`);
  }, []);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Novo Mês de Controle</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>
        <form className={styles.modalBody} onSubmit={e => { e.preventDefault(); if(val) onCreate(val); }}>
          <div className={styles.formGroup}>
            <label>Mês / Ano</label>
            <input type="month" required className={styles.input} value={val} onChange={e => setVal(e.target.value)} />
          </div>
          <button type="submit" className={styles.submitBtn}>Criar Mês</button>
        </form>
      </div>
    </div>
  );
}

function TxModal({ activeMonthId, onClose, onAdd }: { 
  activeMonthId: string, 
  onClose: () => void, 
  onAdd: (data: Omit<FinanceTransaction, 'id' | 'createdAt'>) => void 
}) {
  const [type, setType] = useState<FinanceTransactionType>('expense');
  const [category, setCategory] = useState<FinanceTransactionCategory>('Variável');
  const [desc, setDesc] = useState('');
  const [val, setVal] = useState('');
  
  // Data default hoje local
  const [dt, setDt] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      monthId: activeMonthId,
      type,
      category: type === 'expense' ? category : 'Fixo', // Receitas sempre salvamos 'Fixo' interno por segurança da tipagem (mas ela não usa categoria no front)
      description: desc,
      value: parseFloat(val) || 0,
      date: dt,
    });
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Nova Movimentação</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>
        <form className={styles.modalBody} onSubmit={handleSubmit}>
          
          <div className={styles.typeToggle}>
            <button type="button" 
              className={`${styles.typeBtn} ${type === 'income' ? styles.activeIncome : ''}`}
              onClick={() => setType('income')}
            > Receita </button>
            <button type="button" 
              className={`${styles.typeBtn} ${type === 'expense' ? styles.activeExpense : ''}`}
              onClick={() => setType('expense')}
            > Despesa </button>
          </div>

          <div className={styles.formGroup}>
            <label>Descrição</label>
            <input required type="text" placeholder="Ex: Salário, Mercado, Aluguel" className={styles.input} value={desc} onChange={e => setDesc(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Valor (R$)</label>
              <input required type="number" step="0.01" min="0.01" placeholder="0,00" className={styles.input} value={val} onChange={e => setVal(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label>Data</label>
              <input required type="date" className={styles.input} value={dt} onChange={e => setDt(e.target.value)} />
            </div>
          </div>

          {type === 'expense' && (
            <div className={styles.formGroup}>
              <label>Categoria da Despesa</label>
              <select className={`${styles.input} ${styles.select}`} value={category} onChange={e => setCategory(e.target.value as any)}>
                <option value="Fixo">Fixo (Contas que não mudam muito)</option>
                <option value="Variável">Variável (Luxos, alimentação flutuante)</option>
                <option value="Assinatura">Assinaturas (Netflix, Academia)</option>
              </select>
            </div>
          )}

          <button type="submit" className={styles.submitBtn}>Registrar</button>
        </form>
      </div>
    </div>
  );
}
