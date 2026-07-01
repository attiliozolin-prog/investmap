'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useFinance } from '@/context/FinanceContext';
import { useApp } from '@/context/AppContext';
import { FinanceTransaction, FinanceSection, FinancePaymentStatus, FinanceCpfCnpj } from '@/types';
import { Plus, Trash2, X, Wallet, ShieldAlert, Edit2, Clock, Tags, Receipt, CreditCard, ShoppingBag, ArrowDownCircle } from 'lucide-react';
import styles from './Finances.module.css';
import { useToast } from '@/components/Toast';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${names[parseInt(mo)-1]} ${y}`;
};

const STATUS_LABELS: Record<FinancePaymentStatus, string> = {
  paid:'Pago', auto_debit:'Débito Auto', scheduled:'Agendado', pending:'Pendente', overdue:'Atrasado',
};
const STATUS_CSS: Record<FinancePaymentStatus, string> = {
  paid: styles.statusPaid, auto_debit: styles.statusAuto,
  scheduled: styles.statusScheduled, pending: styles.statusPending, overdue: styles.statusOverdue,
};

const CHART_COLORS = ['#3B82F6','#F59E0B','#FF1493','#10B981','#8B5CF6','#EF4444','#06B6D4','#F97316','#84CC16','#EC4899','#14B8A6','#A78BFA'];

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Finances() {
  const { months, transactions, categories, activeMonthId, setActiveMonthId, createMonth, deleteMonth, addTransaction, deleteTransaction, updateTransaction } = useFinance();
  const { assets } = useApp();
  const { toast } = useToast();

  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [addSection, setAddSection] = useState<FinanceSection | null>(null);
  const [editTx, setEditTx] = useState<FinanceTransaction | null>(null);
  const [monthToDelete, setMonthToDelete] = useState<string | null>(null);
  const [highlightTxId, setHighlightTxId] = useState<string | null>(null);
  const [mobileSection, setMobileSection] = useState<FinanceSection>('boleto');
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortedMonths = useMemo(() => [...months].sort((a,b) => b.month.localeCompare(a.month)), [months]);
  const activeMonth = useMemo(() => months.find(m => m.id === activeMonthId), [months, activeMonthId]);
  const monthTxs = useMemo(() => transactions.filter(t => t.monthId === activeMonthId), [transactions, activeMonthId]);

  const boletos     = useMemo(() => monthTxs.filter(t => t.section==='boleto').sort((a,b)=>(a.dueDay||0)-(b.dueDay||0)), [monthTxs]);
  const assinaturas = useMemo(() => monthTxs.filter(t => t.section==='assinatura'), [monthTxs]);
  const extras      = useMemo(() => monthTxs.filter(t => t.section==='extra'), [monthTxs]);
  const incomes     = useMemo(() => monthTxs.filter(t => t.section==='income'), [monthTxs]);

  const totalBoletos     = useMemo(() => boletos.reduce((s,t)=>s+t.value,0), [boletos]);
  const totalAssinaturas = useMemo(() => assinaturas.reduce((s,t)=>s+t.value,0), [assinaturas]);
  const totalExtras      = useMemo(() => extras.reduce((s,t)=>s+t.value,0), [extras]);
  const totalIncome      = useMemo(() => incomes.reduce((s,t)=>s+t.value,0), [incomes]);

  // Impostos — subconjunto dos boletos com categoria "Impostos" (só para conferência, não somam novamente)
  const impostos     = useMemo(() => boletos.filter(t => (t.category||'').toLowerCase() === 'impostos'), [boletos]);
  const totalImpostos = useMemo(() => impostos.reduce((s,t)=>s+t.value,0), [impostos]);
  // Assinaturas não entram no cálculo de despesas pois já vêm cobradas na fatura do cartão (boleto)
  const totalExp         = totalBoletos + totalExtras;
  const balance          = totalIncome - totalExp;

  const categoryTotals = useMemo(() => {
    const map: Record<string,number> = {};
    // Assinaturas também não entram no gráfico de gastos para evitar duplicidade
    [...boletos,...extras].forEach(t => {
      const cat = t.category || 'Outro';
      map[cat] = (map[cat]||0) + t.value;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value);
  }, [boletos, extras]);

  const totalInvestments = useMemo(() => assets.reduce((s,a)=>s+a.currentValue,0), [assets]);
  const survivalMonths = totalExp > 0 ? totalInvestments / totalExp : 0;
  const survivalYears  = survivalMonths / 12;

  const toggleStatus = (tx: FinanceTransaction) => {
    const cycle: FinancePaymentStatus[] = ['pending','paid','auto_debit','scheduled'];
    const cur = tx.paymentStatus || 'pending';
    const next = cycle[(cycle.indexOf(cur)+1) % cycle.length];
    updateTransaction(tx.id, { paymentStatus: next });
  };

  const handleImportAndCreate = (monthStr: string, selectedTxIds: string[]) => {
    const newMonth = createMonth(monthStr);
    if (selectedTxIds.length > 0) {
      const toCopy = transactions.filter(t => selectedTxIds.includes(t.id));
      toCopy.forEach(t => {
        const { id, createdAt, monthId, ...rest } = t;
        addTransaction({ ...rest, monthId: newMonth.id, paymentStatus: t.section === 'boleto' ? 'pending' : t.paymentStatus });
      });
      toast(`Mês criado com ${selectedTxIds.length} lançamento(s) importado(s)`);
    } else {
      toast('Novo mês criado com sucesso');
    }
    setIsMonthModalOpen(false);
  };

  // Scroll + highlight ao navegar pelo alerta do dashboard
  useEffect(() => {
    const targetId = sessionStorage.getItem('highlight_tx_id');
    if (!targetId) return;
    sessionStorage.removeItem('highlight_tx_id');

    const timer = setTimeout(() => {
      const row = document.getElementById(`tx-row-${targetId}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightTxId(targetId);
        highlightTimerRef.current = setTimeout(() => setHighlightTxId(null), 2000);
      }
    }, 120);

    return () => {
      clearTimeout(timer);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonthId]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.title}><Wallet size={22}/> Controle Financeiro</div>
        <div className={styles.headerRight}>
          <select className={styles.monthSelect} value={activeMonthId||''} onChange={e=>setActiveMonthId(e.target.value)}>
            {sortedMonths.length===0 && <option value="">Nenhum mês</option>}
            {sortedMonths.map(m=><option key={m.id} value={m.id}>{fmtMonth(m.month)}</option>)}
          </select>
          {activeMonthId && (
            <button className={styles.btnSecondary} onClick={() => setMonthToDelete(activeMonthId)}>
              <Trash2 size={16}/> Excluir Mês
            </button>
          )}
          <button className={styles.btnSecondary} onClick={()=>setIsCategoriesModalOpen(true)}>
            <Tags size={16}/> Categorias
          </button>
          <button className={styles.btnPrimary} onClick={()=>setIsMonthModalOpen(true)}>
            <Plus size={16}/> Novo Mês
          </button>
        </div>
      </header>

      {!activeMonth ? (
        <div className={styles.emptyState}>
          <Wallet size={48}/>
          <h2>Organize suas finanças mensais</h2>
          <p style={{ maxWidth: 400, margin: '0.5rem auto 1rem', lineHeight: 1.6 }}>
            Crie o primeiro mês para começar a registrar seus boletos, assinaturas e receitas.
            O InvestMap calcula automaticamente sua sobra, gastos por categoria e tempo de sobrevivência.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', margin: '1rem 0 1.5rem' }}>
            {[
              { icon: <Receipt size={16}/>, label: 'Boletos & Contas' },
              { icon: <CreditCard size={16}/>, label: 'Assinaturas' },
              { icon: <ArrowDownCircle size={16}/>, label: 'Receitas' },
            ].map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-2)' }}>
                {item.icon} {item.label}
              </span>
            ))}
          </div>
          <button className={styles.btnPrimary} onClick={()=>setIsMonthModalOpen(true)}><Plus size={18}/> Criar Primeiro Mês</button>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className={styles.summaryRow}>
            <SummaryCard label="Total de Entradas" value={totalIncome} accent="#10B981"/>
            <SummaryCard label="Boletos" value={totalBoletos} accent="#3B82F6"/>
            <SummaryCard label="Assinaturas" value={totalAssinaturas} accent="#F59E0B"/>
            <SummaryCard label="Gastos Extras" value={totalExtras} accent="#FF1493"/>
            <SummaryCard label="Sobra / Falta" value={balance} accent={balance>=0?'#10B981':'#EF4444'} highlight/>
          </div>

          {/* Sobrevivência */}
          <div className={styles.survivalCard}>
            <div className={styles.survivalIcon}><ShieldAlert size={28}/></div>
            <div className={styles.survivalBody}>
              <div className={styles.survivalTitle}>Tempo de Sobrevivência</div>
              <div className={styles.survivalDesc}>
                Com seu patrimônio investido de <strong>{fmt(totalInvestments)}</strong> e custo mensal de <strong>{fmt(totalExp)}</strong>, você sobreviveria por:
              </div>
            </div>
            <div className={styles.survivalNumbers}>
              <div className={styles.survivalMain}>{survivalMonths>0?`${survivalMonths.toFixed(0)} meses`:'–'}</div>
              {survivalYears>0 && <div className={styles.survivalSub}>≈ {survivalYears.toFixed(1)} anos</div>}
            </div>
          </div>

          {/* Tab bar de seções — estilo Nubank, só visível em mobile */}
          <div className={styles.mobileTabs}>
            {([
              { id: 'boleto'     as FinanceSection, icon: <Receipt     size={20} strokeWidth={1.75}/>, label: 'Boletos',     total: totalBoletos },
              { id: 'assinatura' as FinanceSection, icon: <CreditCard  size={20} strokeWidth={1.75}/>, label: 'Assinaturas', total: totalAssinaturas },
              { id: 'extra'      as FinanceSection, icon: <ShoppingBag size={20} strokeWidth={1.75}/>, label: 'Extras',      total: totalExtras },
              { id: 'income'     as FinanceSection, icon: <ArrowDownCircle size={20} strokeWidth={1.75}/>, label: 'Receitas', total: totalIncome },
            ]).map(tab => (
              <button
                key={tab.id}
                className={`${styles.mobileTabBtn} ${mobileSection === tab.id ? styles.mobileTabActive : ''}`}
                onClick={() => setMobileSection(tab.id)}
              >
                <span className={styles.mobileTabIcon}>{tab.icon}</span>
                <span className={styles.mobileTabLabel}>{tab.label}</span>
                <span className={styles.mobileTabAmount}>{fmt(tab.total)}</span>
              </button>
            ))}
          </div>

          {/* Duas colunas */}
          <div className={styles.twoCol}>
            <div className={styles.colLeft}>
              <div className={mobileSection !== 'boleto' ? styles.mobileHidden : ''}>
              <Section title="Controle de Boletos" total={totalBoletos} accent="#3B82F6" onAdd={()=>setAddSection('boleto')}>
                <table className={styles.table}>
                  <thead><tr><th>Descrição</th><th>Vcto</th><th>Categoria</th><th>CPF/CNPJ</th><th>Valor</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {boletos.length===0 && <tr><td colSpan={7} className={styles.emptyRow}>Nenhum boleto.</td></tr>}
                    {boletos.map(tx=>(
                      <tr key={tx.id} id={`tx-row-${tx.id}`} className={highlightTxId === tx.id ? styles.rowHighlight : ''}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td data-label="Vcto" className={styles.centerCell}>{tx.dueDay?`Dia ${tx.dueDay}`:'–'}</td>
                        <td data-label="Categoria">{tx.category||'–'}</td>
                        <td data-label="Tipo">{tx.cpfCnpj&&<span className={tx.cpfCnpj==='CPF'?styles.tagCpf:styles.tagCnpj}>{tx.cpfCnpj}</span>}</td>
                        <td data-label="Valor" className={styles.valueCell}>{fmt(tx.value)}</td>
                        <td data-label="Status"><button className={`${styles.statusBtn} ${STATUS_CSS[tx.paymentStatus||'pending']}`} onClick={()=>toggleStatus(tx)}>{STATUS_LABELS[tx.paymentStatus||'pending']}</button></td>
                        <td className={styles.actionCell}>
                          <button className={styles.editBtn} onClick={()=>setEditTx(tx)} title="Editar"><Edit2 size={13}/></button>
                          <button className={styles.delBtn} onClick={()=>{deleteTransaction(tx.id);toast('Lançamento removido');}} title="Apagar"><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {boletos.length>0&&<tfoot><tr><td colSpan={5} className={styles.totalLabel}>TOTAL BOLETOS</td><td colSpan={2} className={styles.totalValue}>{fmt(totalBoletos)}</td></tr></tfoot>}
                </table>
              </Section>
              </div>

              <div className={mobileSection !== 'assinatura' ? styles.mobileHidden : ''}>
              <Section title="Assinaturas — Débito Automático" total={totalAssinaturas} accent="#F59E0B" onAdd={()=>setAddSection('assinatura')}>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-3)', padding: '0 0.85rem 0.5rem', fontStyle: 'italic' }}>
                  ℹ️ Estes valores não são somados ao total de gastos pois já estão incluídos na fatura do cartão de crédito.
                </p>
                <table className={styles.table}>
                  <thead><tr><th>Descrição</th><th>Categoria</th><th>Cartão</th><th>Valor</th><th></th></tr></thead>
                  <tbody>
                    {assinaturas.length===0 && <tr><td colSpan={5} className={styles.emptyRow}>Nenhuma assinatura.</td></tr>}
                    {assinaturas.map(tx=>(
                      <tr key={tx.id}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td data-label="Categoria">{tx.category||'–'}</td>
                        <td data-label="Cartão"><span className={styles.tagCard}>{tx.card||'PF'}</span></td>
                        <td data-label="Valor" className={styles.valueCell}>{fmt(tx.value)}</td>
                        <td className={styles.actionCell}>
                          <button className={styles.editBtn} onClick={()=>setEditTx(tx)} title="Editar"><Edit2 size={13}/></button>
                          <button className={styles.delBtn} onClick={()=>{deleteTransaction(tx.id);toast('Lançamento removido');}} title="Apagar"><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {assinaturas.length>0&&<tfoot><tr><td colSpan={3} className={styles.totalLabel}>TOTAL ASSINATURAS</td><td colSpan={2} className={styles.totalValue}>{fmt(totalAssinaturas)}</td></tr></tfoot>}
                </table>
              </Section>
              </div>
            </div>

            <div className={styles.colRight}>
              <div className={mobileSection !== 'extra' ? styles.mobileHidden : ''}>
              <Section title="Gastos Extras" total={totalExtras} accent="#FF1493" onAdd={()=>setAddSection('extra')}>
                <table className={styles.table}>
                  <thead><tr><th>Descrição</th><th>Valor</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {extras.length===0 && <tr><td colSpan={4} className={styles.emptyRow}>Nenhum gasto extra.</td></tr>}
                    {extras.map(tx=>(
                      <tr key={tx.id}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td data-label="Valor" className={styles.valueCell}>{fmt(tx.value)}</td>
                        <td data-label="Status"><button className={`${styles.statusBtn} ${STATUS_CSS[tx.paymentStatus||'pending']}`} onClick={()=>toggleStatus(tx)}>{STATUS_LABELS[tx.paymentStatus||'pending']}</button></td>
                        <td className={styles.actionCell}>
                          <button className={styles.editBtn} onClick={()=>setEditTx(tx)} title="Editar"><Edit2 size={13}/></button>
                          <button className={styles.delBtn} onClick={()=>{deleteTransaction(tx.id);toast('Lançamento removido');}} title="Apagar"><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {extras.length>0&&<tfoot><tr><td colSpan={2} className={styles.totalLabel}>TOTAL EXTRAS</td><td colSpan={2} className={styles.totalValue}>{fmt(totalExtras)}</td></tr></tfoot>}
                </table>
              </Section>
              </div>

              {/* ── Total de Impostos — somente conferência, sem duplicar no total ── */}
              {impostos.length > 0 && (
                <Section title="Total de Impostos" total={totalImpostos} accent="#F59E0B">
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-3)', padding: '0 0.85rem 0.65rem', fontStyle: 'italic' }}>
                    ℹ️ Estes valores já estão incluídos em Controle de Boletos — listados aqui apenas para monitoramento.
                  </p>
                  <table className={styles.table}>
                    <thead><tr><th>Descrição</th><th>Vcto</th><th>Valor</th><th>Status</th></tr></thead>
                    <tbody>
                      {impostos.map(tx => (
                        <tr key={tx.id}>
                          <td className={styles.descCell}>{tx.description}</td>
                          <td data-label="Vcto" className={styles.centerCell}>{tx.dueDay ? `Dia ${tx.dueDay}` : '—'}</td>
                          <td data-label="Valor" className={styles.valueCell}>{fmt(tx.value)}</td>
                          <td data-label="Status">
                            <button
                              className={`${styles.statusBtn} ${STATUS_CSS[tx.paymentStatus||'pending']}`}
                              onClick={() => toggleStatus(tx)}
                            >
                              {STATUS_LABELS[tx.paymentStatus||'pending']}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className={styles.totalLabel}>TOTAL DE IMPOSTOS</td>
                        <td colSpan={2} className={styles.totalValue}>{fmt(totalImpostos)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </Section>
              )}

              <div className={mobileSection !== 'income' ? styles.mobileHidden : ''}>
              <Section title="Entrada e Saída" total={null} accent="#10B981" onAdd={()=>setAddSection('income')}>
                <table className={styles.table}>
                  <thead><tr><th>Descrição</th><th>Valor</th><th></th></tr></thead>
                  <tbody>
                    {incomes.length===0 && <tr><td colSpan={3} className={styles.emptyRow}>Nenhuma entrada registrada.</td></tr>}
                    {incomes.map(tx=>(
                      <tr key={tx.id}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td data-label="Valor" className={`${styles.valueCell} ${styles.incomeValue}`}>{fmt(tx.value)}</td>
                        <td className={styles.actionCell}>
                          <button className={styles.editBtn} onClick={()=>setEditTx(tx)} title="Editar"><Edit2 size={13}/></button>
                          <button className={styles.delBtn} onClick={()=>{deleteTransaction(tx.id);toast('Lançamento removido');}} title="Apagar"><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td colSpan={2} className={styles.totalLabel}>Entradas</td><td className={`${styles.totalValue} ${styles.incomeValue}`}>{fmt(totalIncome)}</td></tr>
                    <tr><td colSpan={2} className={styles.totalLabel}>Gastos do mês</td><td className={`${styles.totalValue} ${styles.expenseValue}`}>{fmt(totalExp)}</td></tr>
                    <tr className={styles.balanceRow}><td colSpan={2} className={styles.totalLabel}>Sobra / Falta</td><td className={`${styles.totalValue} ${balance>=0?styles.incomeValue:styles.expenseValue}`}>{fmt(balance)}</td></tr>
                  </tfoot>
                </table>
              </Section>
              </div>
            </div>
          </div>

          {/* Gráfico de Gastos */}
          {categoryTotals.length>0 && (
            <div className={styles.chartSection}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Distribuição de Gastos por Categoria</h3>
              </div>

              {/* Desktop: donut + legenda */}
              <div className={`${styles.chartBody} ${styles.chartDesktop}`}>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie data={categoryTotals} cx="50%" cy="50%" innerRadius={75} outerRadius={130}
                      paddingAngle={3} dataKey="value"
                      label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}
                      labelLine={true}>
                      {categoryTotals.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={(v:number)=>fmt(v)}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.chartLegend}>
                  {categoryTotals.map((c,i)=>(
                    <div key={c.name} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{background:CHART_COLORS[i%CHART_COLORS.length]}}/>
                      <span className={styles.legendName}>{c.name}</span>
                      <span className={styles.legendVal}>{fmt(c.value)}</span>
                      <span className={styles.legendPct}>{totalExp>0?`${((c.value/totalExp)*100).toFixed(1)}%`:''}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile: lista de barras horizontais rankeadas */}
              <div className={styles.chartMobile}>
                {categoryTotals
                  .slice()
                  .sort((a,b)=>b.value-a.value)
                  .map((c,i)=>{
                    const pct = totalExp>0 ? (c.value/totalExp)*100 : 0;
                    const color = CHART_COLORS[categoryTotals.indexOf(c)%CHART_COLORS.length];
                    return (
                      <div key={c.name} className={styles.chartBarRow}>
                        <div className={styles.chartBarInfo}>
                          <span className={styles.chartBarName}>{c.name}</span>
                          <span className={styles.chartBarVal}>{fmt(c.value)}</span>
                        </div>
                        <div className={styles.chartBarTrack}>
                          <div
                            className={styles.chartBarFill}
                            style={{ width:`${pct}%`, background: color }}
                          />
                        </div>
                        <span className={styles.chartBarPct}>{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {monthToDelete && (
        <DeleteMonthModal
          monthName={fmtMonth(months.find(m=>m.id===monthToDelete)?.month || '')}
          onClose={()=>setMonthToDelete(null)}
          onConfirm={()=>{
            deleteMonth(monthToDelete);
            setMonthToDelete(null);
          }}
        />
      )}
      {isMonthModalOpen && (
        <MonthModal
          months={sortedMonths}
          transactions={transactions}
          onClose={()=>setIsMonthModalOpen(false)}
          onCreate={handleImportAndCreate}
        />
      )}
      {isCategoriesModalOpen && (
        <CategoriesModal onClose={()=>setIsCategoriesModalOpen(false)} />
      )}
      {addSection && activeMonthId && (
        <TxModal section={addSection} monthId={activeMonthId} onClose={()=>setAddSection(null)}
          onSave={(data)=>{
            addTransaction(data);
            toast('Lançamento adicionado com sucesso');
            setAddSection(null);
          }}/>
      )}
      {editTx && (
        <TxModal section={editTx.section} monthId={editTx.monthId} existing={editTx}
          onClose={()=>setEditTx(null)}
          onSave={(data)=>{
            updateTransaction(editTx.id, data as Partial<FinanceTransaction>);
            toast('Lançamento atualizado com sucesso');
            setEditTx(null);
          }}/>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({title,total,accent,onAdd,children}:{title:string;total:number|null;accent:string;onAdd?:()=>void;children:React.ReactNode}) {
  return (
    <div className={styles.section} style={{'--s-accent':accent} as React.CSSProperties}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>{title}</div>
        <div className={styles.sectionHeaderRight}>
          {total!==null&&<span className={styles.sectionTotal}>{fmt(total)}</span>}
          {onAdd && <button className={styles.addBtn} onClick={onAdd}><Plus size={15}/></button>}
        </div>
      </div>
      <div className={styles.tableWrap}>{children}</div>
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({label,value,accent,highlight}:{label:string;value:number;accent:string;highlight?:boolean}) {
  return (
    <div className={styles.summaryCard} style={{'--accent':accent} as React.CSSProperties}>
      <div className={styles.summaryLabel}>{label}</div>
      <div className={styles.summaryValue} style={{color: highlight?(value>=0?'#10B981':'#EF4444'):accent}}>{fmt(value)}</div>
    </div>
  );
}

// ─── Month Modal ──────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const SECTION_LABELS_IMPORT: Record<string,string> = { boleto:'Boletos', assinatura:'Assinaturas', income:'Receitas', extra:'Gastos Extras' };
const SECTION_ORDER = ['boleto','assinatura','income','extra'];

function MonthModal({
  months, transactions, onClose, onCreate
}: {
  months: {id:string;month:string}[];
  transactions: FinanceTransaction[];
  onClose: ()=>void;
  onCreate: (v:string, selectedTxIds:string[])=>void;
}) {
  const now = new Date();
  // Sugere o próximo mês ainda não existente
  const suggestNext = useCallback(() => {
    const existingMonths = new Set(months.map(m => m.month));
    let year = now.getFullYear();
    let month = now.getMonth() + 1; // mês atual
    // tenta até 24 meses à frente para achar o primeiro ausente
    for (let i = 0; i < 24; i++) {
      const key = `${year}-${String(month).padStart(2,'0')}`;
      if (!existingMonths.has(key)) return { year, month };
      month++;
      if (month > 12) { month = 1; year++; }
    }
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, [months]);

  const suggested = useMemo(() => suggestNext(), [suggestNext]);

  const [selYear,  setSelYear]  = useState(suggested.year);
  const [selMonth, setSelMonth] = useState(suggested.month);
  const [importFrom, setImportFrom] = useState<string>('none');

  // step: 'config' | 'select'
  const [step, setStep] = useState<'config'|'select'>('config');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const monthStr = `${selYear}-${String(selMonth).padStart(2,'0')}`;
  const alreadyExists = months.some(m => m.month === monthStr);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return Array.from({length: 5}, (_, i) => y - 1 + i);
  }, []);

  // Lançamentos disponíveis no mês de origem
  const importableTxs = useMemo(() => {
    if (importFrom === 'none') return [];
    return transactions.filter(t =>
      t.monthId === importFrom &&
      (t.section === 'boleto' || t.section === 'assinatura' || t.section === 'income' || t.section === 'extra')
    );
  }, [importFrom, transactions]);

  const grouped = useMemo(() => {
    const map: Record<string, FinanceTransaction[]> = {};
    importableTxs.forEach(t => {
      if (!map[t.section]) map[t.section] = [];
      map[t.section].push(t);
    });
    return map;
  }, [importableTxs]);

  const handleGoToSelect = (e: React.FormEvent) => {
    e.preventDefault();
    if (importFrom === 'none') {
      // sem importação → criar direto
      onCreate(monthStr, []);
      return;
    }
    // pré-selecionar todos
    setSelectedIds(new Set(importableTxs.map(t => t.id)));
    setStep('select');
  };

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSection = (section: string) => {
    const ids = (grouped[section] || []).map(t => t.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleCreate = () => {
    onCreate(monthStr, Array.from(selectedIds));
  };

  const fmt2 = (v: number) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v);

  if (step === 'select') {
    const totalSelected = importableTxs
      .filter(t => selectedIds.has(t.id))
      .reduce((s, t) => s + t.value, 0);

    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modalFlex} onClick={e=>e.stopPropagation()}>

          {/* ── Header fixo ───────────────────────────────────────── */}
          <div className={styles.modalHead}>
            <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
              <button className={styles.closeBtn} onClick={()=>setStep('config')} title="Voltar" style={{marginRight:0}}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h3 style={{margin:0}}>Selecionar Lançamentos</h3>
            </div>
            <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
          </div>

          {/* ── Lista rolável ─────────────────────────────────────── */}
          <div className={styles.modalScrollBody}>
            <p style={{fontSize:'0.8rem',color:'var(--color-text-2)',margin:0,lineHeight:1.5}}>
              Importando de <strong style={{color:'var(--color-text)'}}>{fmtMonth(months.find(m=>m.id===importFrom)?.month||'')}</strong> → <strong style={{color:'var(--color-text)'}}>{MONTH_NAMES[selMonth-1]} {selYear}</strong>
            </p>

            {/* Ações em massa */}
            <div style={{display:'flex',gap:'0.5rem'}}>
              <button type="button" className={styles.btnPrimary}
                style={{fontSize:'0.75rem',padding:'0.3rem 0.75rem'}}
                onClick={()=>setSelectedIds(new Set(importableTxs.map(t=>t.id)))}
              >Selecionar todos</button>
              <button type="button" className={styles.btnSecondary}
                style={{fontSize:'0.75rem',padding:'0.3rem 0.75rem',color:'var(--color-text-2)',borderColor:'var(--color-border)'}}
                onClick={()=>setSelectedIds(new Set())}
              >Limpar seleção</button>
            </div>

            {/* Grupos por seção */}
            {SECTION_ORDER.filter(s => grouped[s]?.length).map(section => {
              const txs = grouped[section];
              const allSel = txs.every(t => selectedIds.has(t.id));
              const someSel = txs.some(t => selectedIds.has(t.id));
              return (
                <div key={section} className={styles.importGroup}>
                  <div className={styles.importGroupHeader} onClick={()=>toggleSection(section)}>
                    <input
                      type="checkbox"
                      checked={allSel}
                      ref={el => { if(el) el.indeterminate = !allSel && someSel; }}
                      onChange={()=>toggleSection(section)}
                      onClick={e=>e.stopPropagation()}
                      className={styles.importCheck}
                    />
                    <span className={styles.importGroupLabel}>{SECTION_LABELS_IMPORT[section]}</span>
                    <span className={styles.importGroupCount}>{txs.filter(t=>selectedIds.has(t.id)).length}/{txs.length}</span>
                  </div>
                  {txs.map(tx => (
                    <label key={tx.id} className={styles.importRow}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(tx.id)}
                        onChange={()=>toggleId(tx.id)}
                        className={styles.importCheck}
                      />
                      <span className={styles.importDesc}>{tx.description}</span>
                      <span className={styles.importVal}>{fmt2(tx.value)}</span>
                    </label>
                  ))}
                </div>
              );
            })}

            {importableTxs.length === 0 && (
              <p style={{color:'var(--color-text-2)',fontSize:'0.85rem',textAlign:'center',padding:'1rem 0'}}>Nenhum lançamento disponível neste mês.</p>
            )}
          </div>

          {/* ── Footer fixo ───────────────────────────────────────── */}
          <div className={styles.modalFooter}>
            <div style={{flex:1}}>
              <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--color-text)'}}>
                {selectedIds.size} lançamento{selectedIds.size !== 1 ? 's' : ''}
              </div>
              {selectedIds.size > 0 && (
                <div style={{fontSize:'0.75rem',color:'var(--color-text-2)',marginTop:'0.1rem'}}>
                  {fmt2(totalSelected)}
                </div>
              )}
            </div>
            <button type="button" className={styles.submitBtn} style={{margin:0,padding:'0.6rem 1.5rem'}} onClick={handleCreate}>
              Criar Mês
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3>Novo Mês de Controle</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
        </div>
        <form className={styles.modalBody} onSubmit={handleGoToSelect}>
          <div className={styles.formGroup}>
            <label>Mês / Ano</label>
            <div className={styles.monthYearPicker}>
              <select
                className={styles.input}
                value={selMonth}
                onChange={e=>setSelMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((name,i) => (
                  <option key={i+1} value={i+1}>{name}</option>
                ))}
              </select>
              <select
                className={styles.input}
                value={selYear}
                onChange={e=>setSelYear(Number(e.target.value))}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {alreadyExists && (
              <span className={styles.inputHint} style={{color:'#F59E0B'}}>
                ⚠️ Este mês já existe. Escolha outro período.
              </span>
            )}
          </div>

          {months.length > 0 && (
            <div className={styles.formGroup}>
              <label>Importar lançamentos de</label>
              <select className={styles.input} value={importFrom} onChange={e=>setImportFrom(e.target.value)}>
                <option value="none">Não importar</option>
                {months.map(m=><option key={m.id} value={m.id}>{fmtMonth(m.month)}</option>)}
              </select>
              {importFrom !== 'none' && (
                <span className={styles.inputHint}>
                  Você poderá escolher exatamente quais lançamentos importar no próximo passo.
                </span>
              )}
              {importFrom === 'none' && (
                <span className={styles.inputHint}>Boletos, assinaturas e receitas podem ser copiados com status "Pendente".</span>
              )}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={alreadyExists}
            style={{opacity: alreadyExists ? 0.5 : 1}}
          >
            {importFrom === 'none' ? 'Criar Mês' : 'Próximo: Escolher Lançamentos →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Categories Modal ─────────────────────────────────────────────────────────
function CategoriesModal({ onClose }: { onClose: () => void }) {
  const { categories, addCategory, updateCategory, deleteCategory } = useFinance();
  const sorted = [...categories].sort((a,b)=>a.name.localeCompare(b.name));
  const [newCat, setNewCat] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if(newCat.trim()) {
      addCategory(newCat.trim());
      setNewCat('');
    }
  };

  const handleSaveEdit = (id: string) => {
    if(editName.trim()) {
      updateCategory(id, editName.trim());
    }
    setEditId(null);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()} style={{maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
        <div className={styles.modalHead}>
          <h3>Categorias</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
        </div>
        <div className={styles.modalBody} style={{overflowY:'auto',padding:'1.5rem'}}>
          <form onSubmit={handleAdd} style={{display:'flex',gap:'0.5rem',marginBottom:'1.5rem'}}>
            <input required type="text" className={styles.input} style={{flex:1}} value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="Nova categoria..."/>
            <button type="submit" className={styles.btnPrimary} style={{padding:'0 1rem'}}><Plus size={18}/></button>
          </form>
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
            {sorted.map(c => (
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:'0.5rem',padding:'0.5rem 0.75rem',background:'var(--color-surface-2)',borderRadius:'0.5rem',border:'1px solid var(--color-border)'}}>
                {editId === c.id ? (
                  <form onSubmit={(e)=>{e.preventDefault(); handleSaveEdit(c.id);}} style={{display:'flex',flex:1,gap:'0.5rem'}}>
                    <input autoFocus type="text" className={styles.input} style={{flex:1,padding:'0.3rem 0.5rem'}} value={editName} onChange={e=>setEditName(e.target.value)} />
                    <button type="submit" className={styles.btnPrimary} style={{padding:'0 0.75rem'}}>Salvar</button>
                    <button type="button" className={styles.btnSecondary} style={{padding:'0 0.75rem'}} onClick={()=>setEditId(null)}>Cancelar</button>
                  </form>
                ) : (
                  <>
                    <span style={{flex:1,fontSize:'0.9rem',color:'var(--color-text)'}}>{c.name}</span>
                    <button className={styles.editBtn} onClick={()=>{setEditId(c.id); setEditName(c.name);}}><Edit2 size={15}/></button>
                    <button className={styles.delBtn} onClick={()=>{if(confirm(`Excluir a categoria "${c.name}"?`)) deleteCategory(c.id);}}><Trash2 size={15}/></button>
                  </>
                )}
              </div>
            ))}
            {sorted.length === 0 && <p style={{color:'var(--color-text-2)',fontSize:'0.9rem',textAlign:'center',padding:'1rem 0'}}>Nenhuma categoria.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Delete Month Modal ───────────────────────────────────────────────────────
function DeleteMonthModal({monthName,onClose,onConfirm}:{monthName:string;onClose:()=>void;onConfirm:()=>void}) {
  const [val,setVal] = useState('');
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <div className={styles.modalHead}><h3>Excluir Mês</h3><button className={styles.closeBtn} onClick={onClose}><X size={20}/></button></div>
        <form className={styles.modalBody} onSubmit={e=>{e.preventDefault();if(val==='EXCLUIR')onConfirm();}}>
          <p style={{fontSize:'0.9rem',color:'var(--color-text)',lineHeight:'1.5'}}>
            Tem certeza que deseja excluir o mês <strong>{monthName}</strong> e TODOS os seus lançamentos?<br/>Esta ação é permanente.
          </p>
          <div className={styles.formGroup} style={{marginTop:'1rem',marginBottom:'1rem'}}>
            <label>Digite <strong>EXCLUIR</strong> para confirmar</label>
            <input type="text" required className={styles.input} value={val} onChange={e=>setVal(e.target.value)} placeholder="EXCLUIR"/>
          </div>
          <button type="submit" className={styles.btnSecondary} style={{width:'100%',justifyContent:'center',opacity:val!=='EXCLUIR'?0.5:1}} disabled={val!=='EXCLUIR'}>
            <Trash2 size={16}/> Excluir Definitivamente
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Transaction Modal ────────────────────────────────────────────────────────
const SECTION_LABELS: Record<FinanceSection,string> = {boleto:'Novo Boleto',assinatura:'Nova Assinatura',extra:'Novo Gasto Extra',income:'Nova Receita'};
const SECTION_ICONS: Record<FinanceSection,React.ReactNode> = {boleto:<Receipt size={18} style={{color:'#3B82F6'}}/>,assinatura:<CreditCard size={18} style={{color:'#F59E0B'}}/>,extra:<ShoppingBag size={18} style={{color:'#FF1493'}}/>,income:<ArrowDownCircle size={18} style={{color:'#10B981'}}/>};

function TxModal({section,monthId,existing,onClose,onSave}:{
  section: FinanceSection;
  monthId: string;
  existing?: FinanceTransaction;
  onClose: () => void;
  onSave: (data: Omit<FinanceTransaction,'id'|'createdAt'>) => void;
}) {
  const { categories } = useFinance();
  const sortedCategories = [...categories].sort((a,b)=>a.name.localeCompare(b.name));

  const [desc,setDesc]     = useState(existing?.description||'');
  const [value,setValue]   = useState(existing?.value?String(existing.value):'');
  const [category,setCat]  = useState(existing?.category||(sortedCategories[0]?.name||'Outro'));
  const [dueDay,setDueDay] = useState(existing?.dueDay?String(existing.dueDay):'');
  const [cpfCnpj,setCpf]   = useState<FinanceCpfCnpj>(existing?.cpfCnpj||'CPF');
  const [payStatus,setPay] = useState<FinancePaymentStatus>(existing?.paymentStatus||'pending');
  const [card,setCard]     = useState(existing?.card||'PF');
  const defaultDate = existing?.date || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const [date,setDate] = useState(defaultDate);

  const isExpense = section !== 'income';
  const isEdit = !!existing;

  const handleSubmit = (e:React.FormEvent) => {
    e.preventDefault();
    const data = {
      monthId, type: (isExpense?'expense':'income') as 'income'|'expense',
      section, description: desc, value: parseFloat(value)||0, date,
      category: isExpense?category:undefined,
      dueDay: section==='boleto'&&dueDay?parseInt(dueDay):undefined,
      cpfCnpj: section==='boleto'?cpfCnpj:undefined,
      paymentStatus: (section==='boleto'||section==='extra')?payStatus:undefined,
      card: section==='assinatura'?card:undefined,
    };
    onSave(data);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3 style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>{SECTION_ICONS[section]}{isEdit?`Editar ${SECTION_LABELS[section].replace('Nov','Nov')}`:`${SECTION_LABELS[section]}`}</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
        </div>
        <form className={styles.modalBody} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Descrição</label>
            <input required type="text" className={styles.input} value={desc}
              placeholder={section==='income'?'Ex: Salário, Dividendos...':'Ex: Aluguel, Netflix...'}
              onChange={e=>setDesc(e.target.value)}/>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Valor (R$)</label>
              <input required type="number" step="0.01" min="0.01" className={styles.input} value={value} placeholder="0,00" onChange={e=>setValue(e.target.value)}/>
            </div>
            <div className={styles.formGroup}>
              <label>Data</label>
              <input required type="date" className={styles.input} value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
          </div>
          {isExpense&&<div className={styles.formGroup}><label>Categoria</label><select className={styles.input} value={category} onChange={e=>setCat(e.target.value)}>{sortedCategories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>}
          {section==='boleto'&&(
            <div className={styles.formRow}>
              <div className={styles.formGroup}><label>Dia de Vencimento</label><input type="number" min="1" max="31" className={styles.input} value={dueDay} placeholder="Ex: 5" onChange={e=>setDueDay(e.target.value)}/></div>
              <div className={styles.formGroup}><label>CPF / CNPJ</label><select className={styles.input} value={cpfCnpj} onChange={e=>setCpf(e.target.value as FinanceCpfCnpj)}><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></select></div>
            </div>
          )}
          {(section==='boleto'||section==='extra')&&(
            <div className={styles.formGroup}><label>Status de Pagamento</label><select className={styles.input} value={payStatus} onChange={e=>setPay(e.target.value as FinancePaymentStatus)}><option value="pending">Pendente</option><option value="paid">Pago</option><option value="auto_debit">Débito Automático</option><option value="scheduled">Agendado</option><option value="overdue">Atrasado</option></select></div>
          )}
          {section==='assinatura'&&<div className={styles.formGroup}><label>Cartão / Forma</label><input type="text" className={styles.input} value={card} placeholder="Ex: Nubank PF" onChange={e=>setCard(e.target.value)}/></div>}
          <button type="submit" className={styles.submitBtn}>{isEdit?'Salvar Alterações':'Registrar'}</button>
        </form>
      </div>
    </div>
  );
}
