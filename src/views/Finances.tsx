'use client';

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useApp } from '@/context/AppContext';
import {
  FinanceTransaction, FinanceSection, FinancePaymentStatus, FinanceCpfCnpj
} from '@/types';
import {
  Plus, Trash2, X, Wallet, Clock, ShieldAlert, ChevronDown, ChevronUp, Edit2, Check
} from 'lucide-react';
import styles from './Finances.module.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${names[parseInt(mo) - 1]} ${y}`;
};

const STATUS_LABELS: Record<FinancePaymentStatus, string> = {
  paid:       'Pago',
  auto_debit: 'Débito Auto',
  scheduled:  'Agendado',
  pending:    'Pendente',
  overdue:    'Atrasado',
};

const STATUS_CSS: Record<FinancePaymentStatus, string> = {
  paid:       styles.statusPaid,
  auto_debit: styles.statusAuto,
  scheduled:  styles.statusScheduled,
  pending:    styles.statusPending,
  overdue:    styles.statusOverdue,
};

const CATEGORIES = [
  'Sobrevivência','Cartão Crédito','Telefonia','Esporte','Energia',
  'Limpeza e Manutenção','Saúde','Contabilidade','Impostos','Lazer',
  'Alimentação','Transporte','Educação','Outro',
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Finances() {
  const { months, transactions, activeMonthId, setActiveMonthId, createMonth, addTransaction, deleteTransaction, updateTransaction } = useFinance();
  const { assets } = useApp();

  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [addSection, setAddSection] = useState<FinanceSection | null>(null);

  const sortedMonths = useMemo(() =>
    [...months].sort((a, b) => b.month.localeCompare(a.month)), [months]);

  const activeMonth = useMemo(() =>
    months.find(m => m.id === activeMonthId), [months, activeMonthId]);

  const monthTxs = useMemo(() =>
    transactions.filter(t => t.monthId === activeMonthId),
    [transactions, activeMonthId]);

  const boletos     = useMemo(() => monthTxs.filter(t => t.section === 'boleto').sort((a,b) => (a.dueDay||0) - (b.dueDay||0)), [monthTxs]);
  const assinaturas = useMemo(() => monthTxs.filter(t => t.section === 'assinatura'), [monthTxs]);
  const extras      = useMemo(() => monthTxs.filter(t => t.section === 'extra'), [monthTxs]);
  const incomes     = useMemo(() => monthTxs.filter(t => t.section === 'income'), [monthTxs]);

  const totalBoletos     = useMemo(() => boletos.reduce((s, t) => s + t.value, 0), [boletos]);
  const totalAssinaturas = useMemo(() => assinaturas.reduce((s, t) => s + t.value, 0), [assinaturas]);
  const totalExtras      = useMemo(() => extras.reduce((s, t) => s + t.value, 0), [extras]);
  const totalIncome      = useMemo(() => incomes.reduce((s, t) => s + t.value, 0), [incomes]);
  const totalExp         = totalBoletos + totalAssinaturas + totalExtras;
  const balance          = totalIncome - totalExp;

  // Totais por categoria (para rodapé)
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    [...boletos, ...assinaturas, ...extras].forEach(t => {
      const cat = t.category || 'Outro';
      map[cat] = (map[cat] || 0) + t.value;
    });
    return map;
  }, [boletos, assinaturas, extras]);

  const totalInvestments = useMemo(() =>
    assets.reduce((s, a) => s + a.currentValue, 0), [assets]);

  const survivalMonths = totalExp > 0 ? (totalInvestments / totalExp) : 0;

  const toggleStatus = (tx: FinanceTransaction) => {
    const cycle: FinancePaymentStatus[] = ['pending','paid','auto_debit','scheduled'];
    const cur = tx.paymentStatus || 'pending';
    const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
    updateTransaction(tx.id, { paymentStatus: next });
  };

  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.title}>
          <Wallet size={22} /> Controle Financeiro
        </div>
        <div className={styles.headerRight}>
          <select
            className={styles.monthSelect}
            value={activeMonthId || ''}
            onChange={e => setActiveMonthId(e.target.value)}
          >
            {sortedMonths.length === 0 && <option value="">Nenhum mês</option>}
            {sortedMonths.map(m => (
              <option key={m.id} value={m.id}>{fmtMonth(m.month)}</option>
            ))}
          </select>
          <button className={styles.btnPrimary} onClick={() => setIsMonthModalOpen(true)}>
            <Plus size={16} /> Novo Mês
          </button>
        </div>
      </header>

      {!activeMonth ? (
        <EmptyState onNew={() => setIsMonthModalOpen(true)} />
      ) : (
        <>
          {/* ── Cards de Resumo ── */}
          <div className={styles.summaryRow}>
            <SummaryCard label="Total de Entradas" value={totalIncome} accent="#10B981" />
            <SummaryCard label="Boletos" value={totalBoletos} accent="#3B82F6" />
            <SummaryCard label="Assinaturas" value={totalAssinaturas} accent="#F59E0B" />
            <SummaryCard label="Gastos Extras" value={totalExtras} accent="#FF1493" />
            <SummaryCard
              label="Sobra / Falta"
              value={balance}
              accent={balance >= 0 ? '#10B981' : '#EF4444'}
              highlight
            />
          </div>

          {/* ── Tempo de Sobrevivência ── */}
          <div className={styles.survivalCard}>
            <div className={styles.survivalLeft}>
              <div className={styles.survivalTitle}><ShieldAlert size={18} /> Tempo de Sobrevivência</div>
              <div className={styles.survivalDesc}>
                Patrimônio investido {fmt(totalInvestments)} ÷ Custo mensal {fmt(totalExp)}
              </div>
            </div>
            <div className={styles.survivalValue}>
              {survivalMonths > 0 ? `${survivalMonths.toFixed(1)} meses` : '–'}
            </div>
          </div>

          {/* ── Layout 2 colunas ── */}
          <div className={styles.twoCol}>

            {/* ── Coluna Esquerda: Boletos + Assinaturas ── */}
            <div className={styles.colLeft}>

              {/* Boletos */}
              <Section
                title="Controle de Boletos"
                total={totalBoletos}
                accent="#3B82F6"
                onAdd={() => setAddSection('boleto')}
              >
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Vcto</th>
                      <th>Categoria</th>
                      <th>CPF/CNPJ</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {boletos.length === 0 && (
                      <tr><td colSpan={7} className={styles.emptyRow}>Nenhum boleto. Clique em + para adicionar.</td></tr>
                    )}
                    {boletos.map(tx => (
                      <tr key={tx.id}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td className={styles.centerCell}>{tx.dueDay ? `Dia ${tx.dueDay}` : '–'}</td>
                        <td>{tx.category || '–'}</td>
                        <td>
                          {tx.cpfCnpj && (
                            <span className={tx.cpfCnpj === 'CPF' ? styles.tagCpf : styles.tagCnpj}>
                              {tx.cpfCnpj}
                            </span>
                          )}
                        </td>
                        <td className={styles.valueCell}>{fmt(tx.value)}</td>
                        <td>
                          <button
                            className={`${styles.statusBtn} ${STATUS_CSS[tx.paymentStatus || 'pending']}`}
                            onClick={() => toggleStatus(tx)}
                            title="Clique para alternar status"
                          >
                            {STATUS_LABELS[tx.paymentStatus || 'pending']}
                          </button>
                        </td>
                        <td>
                          <button className={styles.delBtn} onClick={() => { if(confirm('Apagar?')) deleteTransaction(tx.id); }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {boletos.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={4} className={styles.totalLabel}>TOTAL</td>
                        <td className={styles.totalValue}>{fmt(totalBoletos)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </Section>

              {/* Assinaturas */}
              <Section
                title="Assinaturas — Débito Automático"
                total={totalAssinaturas}
                accent="#F59E0B"
                onAdd={() => setAddSection('assinatura')}
              >
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Cartão</th>
                      <th>Valor</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assinaturas.length === 0 && (
                      <tr><td colSpan={5} className={styles.emptyRow}>Nenhuma assinatura.</td></tr>
                    )}
                    {assinaturas.map(tx => (
                      <tr key={tx.id}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td>{tx.category || '–'}</td>
                        <td><span className={styles.tagCard}>{tx.card || 'PF'}</span></td>
                        <td className={styles.valueCell}>{fmt(tx.value)}</td>
                        <td>
                          <button className={styles.delBtn} onClick={() => { if(confirm('Apagar?')) deleteTransaction(tx.id); }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {assinaturas.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3} className={styles.totalLabel}>TOTAL</td>
                        <td className={styles.totalValue}>{fmt(totalAssinaturas)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </Section>
            </div>

            {/* ── Coluna Direita: Extras + Entrada/Saída ── */}
            <div className={styles.colRight}>

              {/* Gastos Extras */}
              <Section
                title="Gastos Extras"
                total={totalExtras}
                accent="#FF1493"
                onAdd={() => setAddSection('extra')}
              >
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {extras.length === 0 && (
                      <tr><td colSpan={4} className={styles.emptyRow}>Nenhum gasto extra.</td></tr>
                    )}
                    {extras.map(tx => (
                      <tr key={tx.id}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td className={styles.valueCell}>{fmt(tx.value)}</td>
                        <td>
                          <button
                            className={`${styles.statusBtn} ${STATUS_CSS[tx.paymentStatus || 'pending']}`}
                            onClick={() => toggleStatus(tx)}
                          >
                            {STATUS_LABELS[tx.paymentStatus || 'pending']}
                          </button>
                        </td>
                        <td>
                          <button className={styles.delBtn} onClick={() => { if(confirm('Apagar?')) deleteTransaction(tx.id); }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {extras.length > 0 && (
                    <tfoot>
                      <tr>
                        <td className={styles.totalLabel}>TOTAL</td>
                        <td className={styles.totalValue}>{fmt(totalExtras)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </Section>

              {/* Entrada e Saída */}
              <Section
                title="Entrada e Saída"
                total={null}
                accent="#10B981"
                onAdd={() => setAddSection('income')}
              >
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomes.length === 0 && (
                      <tr><td colSpan={3} className={styles.emptyRow}>Nenhuma entrada registrada.</td></tr>
                    )}
                    {incomes.map(tx => (
                      <tr key={tx.id}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td className={`${styles.valueCell} ${styles.incomeValue}`}>{fmt(tx.value)}</td>
                        <td>
                          <button className={styles.delBtn} onClick={() => { if(confirm('Apagar?')) deleteTransaction(tx.id); }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className={styles.totalLabel}>Total de entrada</td>
                      <td className={`${styles.totalValue} ${styles.incomeValue}`}>{fmt(totalIncome)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td className={styles.totalLabel}>Gastos do mês</td>
                      <td className={`${styles.totalValue} ${styles.expenseValue}`}>{fmt(totalExp)}</td>
                      <td></td>
                    </tr>
                    <tr className={styles.balanceRow}>
                      <td className={styles.totalLabel}>Sobra / Falta</td>
                      <td className={`${styles.totalValue} ${balance >= 0 ? styles.incomeValue : styles.expenseValue}`}>
                        {fmt(balance)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </Section>

              {/* Totais por Categoria */}
              {Object.keys(categoryTotals).length > 0 && (
                <div className={styles.catTotalsGrid}>
                  {Object.entries(categoryTotals).map(([cat, val]) => (
                    <div key={cat} className={styles.catTotalCard}>
                      <div className={styles.catTotalLabel}>{cat}</div>
                      <div className={styles.catTotalValue}>{fmt(val)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {isMonthModalOpen && (
        <MonthModal
          onClose={() => setIsMonthModalOpen(false)}
          onCreate={v => { createMonth(v); setIsMonthModalOpen(false); }}
        />
      )}

      {addSection && activeMonthId && (
        <TxModal
          section={addSection}
          monthId={activeMonthId}
          onClose={() => setAddSection(null)}
          onAdd={data => { addTransaction(data); setAddSection(null); }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className={styles.emptyState}>
      <Clock size={48} />
      <h2>Nenhum mês criado ainda</h2>
      <p>Inicie seu controle financeiro criando o primeiro mês.</p>
      <button className={styles.btnPrimary} onClick={onNew}>
        <Plus size={18} /> Criar Primeiro Mês
      </button>
    </div>
  );
}

function SummaryCard({ label, value, accent, highlight }: {
  label: string; value: number; accent: string; highlight?: boolean;
}) {
  return (
    <div className={styles.summaryCard} style={{ '--accent': accent } as React.CSSProperties}>
      <div className={styles.summaryLabel}>{label}</div>
      <div className={`${styles.summaryValue} ${highlight ? styles.summaryHighlight : ''}`}
           style={highlight ? { color: value >= 0 ? '#10B981' : '#EF4444' } : { color: accent }}>
        {fmt(value)}
      </div>
    </div>
  );
}

function Section({ title, total, accent, onAdd, children }: {
  title: string; total: number | null; accent: string; onAdd: () => void; children: React.ReactNode;
}) {
  return (
    <div className={styles.section} style={{ '--s-accent': accent } as React.CSSProperties}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>{title}</div>
        <div className={styles.sectionHeaderRight}>
          {total !== null && <span className={styles.sectionTotal}>{fmt(total)}</span>}
          <button className={styles.addBtn} onClick={onAdd} title="Adicionar">
            <Plus size={15} />
          </button>
        </div>
      </div>
      <div className={styles.tableWrap}>{children}</div>
    </div>
  );
}

// ─── Month Modal ─────────────────────────────────────────────────────────────

function MonthModal({ onClose, onCreate }: { onClose: () => void; onCreate: (v: string) => void }) {
  const [val, setVal] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3>Novo Mês de Controle</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
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

// ─── Transaction Modal ────────────────────────────────────────────────────────

const SECTION_LABELS: Record<FinanceSection, string> = {
  boleto: 'Boleto',
  assinatura: 'Assinatura',
  extra: 'Gasto Extra',
  income: 'Receita',
};

function TxModal({ section, monthId, onClose, onAdd }: {
  section: FinanceSection;
  monthId: string;
  onClose: () => void;
  onAdd: (data: Omit<FinanceTransaction, 'id' | 'createdAt'>) => void;
}) {
  const [desc, setDesc] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [dueDay, setDueDay] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState<FinanceCpfCnpj>('CPF');
  const [paymentStatus, setPaymentStatus] = useState<FinancePaymentStatus>('pending');
  const [card, setCard] = useState('PF');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

  const isExpense = section !== 'income';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      monthId,
      type: isExpense ? 'expense' : 'income',
      section,
      description: desc,
      value: parseFloat(value) || 0,
      date,
      category: isExpense ? category : undefined,
      dueDay: section === 'boleto' && dueDay ? parseInt(dueDay) : undefined,
      cpfCnpj: section === 'boleto' ? cpfCnpj : undefined,
      paymentStatus: (section === 'boleto' || section === 'extra') ? paymentStatus : undefined,
      card: section === 'assinatura' ? card : undefined,
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3>+ {SECTION_LABELS[section]}</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
        </div>
        <form className={styles.modalBody} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Descrição</label>
            <input required type="text" className={styles.input} value={desc}
              placeholder={section === 'income' ? 'Ex: Salário, Dividendos...' : 'Ex: Aluguel, Netflix...'}
              onChange={e => setDesc(e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Valor (R$)</label>
              <input required type="number" step="0.01" min="0.01" className={styles.input}
                value={value} placeholder="0,00" onChange={e => setValue(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label>Data</label>
              <input required type="date" className={styles.input} value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {isExpense && (
            <div className={styles.formGroup}>
              <label>Categoria</label>
              <select className={styles.input} value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {section === 'boleto' && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Dia de Vencimento</label>
                <input type="number" min="1" max="31" className={styles.input}
                  value={dueDay} placeholder="Ex: 5" onChange={e => setDueDay(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>CPF / CNPJ</label>
                <select className={styles.input} value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value as FinanceCpfCnpj)}>
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                </select>
              </div>
            </div>
          )}

          {(section === 'boleto' || section === 'extra') && (
            <div className={styles.formGroup}>
              <label>Status de Pagamento</label>
              <select className={styles.input} value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as FinancePaymentStatus)}>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="auto_debit">Débito Automático</option>
                <option value="scheduled">Agendado</option>
                <option value="overdue">Atrasado</option>
              </select>
            </div>
          )}

          {section === 'assinatura' && (
            <div className={styles.formGroup}>
              <label>Cartão / Forma de Pagamento</label>
              <input type="text" className={styles.input} value={card}
                placeholder="Ex: Nubank PF, Itaú PJ..." onChange={e => setCard(e.target.value)} />
            </div>
          )}

          <button type="submit" className={styles.submitBtn}>Registrar</button>
        </form>
      </div>
    </div>
  );
}
