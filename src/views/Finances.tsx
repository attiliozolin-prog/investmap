'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { FinanceTransaction, FinanceSection, FinancePaymentStatus, FinanceCpfCnpj, FinanceSubscription, FinanceMonth } from '@/types';
import {
  Plus, Trash2, X, Wallet, Edit2, Tags, Receipt, CreditCard, ShoppingBag,
  ArrowDownCircle, ArrowUpCircle, Sparkles, ChevronLeft, ChevronRight,
  CalendarClock, CheckCircle2, Lock, ScanLine,
} from 'lucide-react';
import styles from './Finances.module.css';
import { useToast } from '@/components/Toast';
import { iconForCategory, isCardCategory } from '@/lib/financeCategories';
import FinanceImportModal from '@/components/FinanceImportModal';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  return `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`;
};

function addMonthsToStr(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** Mantém o dia da data original, mas move mês/ano para o novo mês de destino. */
function shiftDateToMonth(dateIso: string, monthStr: string): string {
  const day = new Date(dateIso).getUTCDate();
  const [y, m] = monthStr.split('-');
  return `${y}-${m}-${String(day).padStart(2, '0')}`;
}

const STATUS_LABELS: Record<FinancePaymentStatus, string> = {
  paid: '● Pago', pending: '○ Pendente', previsto: '≈ Previsto',
  auto_debit: '⟳ Débito Auto', scheduled: '◷ Agendado', overdue: '! Atrasado',
};
const STATUS_CSS: Record<FinancePaymentStatus, string> = {
  paid: styles.statusPaid, auto_debit: styles.statusAuto, scheduled: styles.statusScheduled,
  pending: styles.statusPending, previsto: styles.statusPrevisto, overdue: styles.statusOverdue,
};
// Opções oferecidas no picker (seleção direta — sem ciclar às cegas)
const STATUS_OPTIONS: FinancePaymentStatus[] = ['pending', 'previsto', 'paid', 'scheduled', 'auto_debit'];
const needsAction = (st?: FinancePaymentStatus) => st === 'pending' || st === 'scheduled' || st === 'previsto';

/** Média dos totais da categoria nos últimos meses (até `maxMonths`), a partir do mês de origem, inclusive. */
function avgForCategoryAcrossMonths(
  category: string, txs: FinanceTransaction[], monthsDesc: FinanceMonth[], fromMonthId: string, maxMonths = 3
): number | null {
  const idx = monthsDesc.findIndex(m => m.id === fromMonthId);
  if (idx === -1) return null;
  const relevant = monthsDesc.slice(idx, idx + maxMonths);
  const sums = relevant
    .map(m => txs.filter(t => t.monthId === m.id && t.category === category).reduce((s, t) => s + t.value, 0))
    .filter(v => v > 0);
  if (sums.length === 0) return null;
  return sums.reduce((a, b) => a + b, 0) / sums.length;
}

function sumBy<T extends { value: number }>(list: T[], pred: (t: T) => boolean): number {
  return list.filter(pred).reduce((a, t) => a + t.value, 0);
}
function sobraDe(txs: FinanceTransaction[]) {
  const rec = sumBy(txs, t => t.section === 'income');
  const sai = sumBy(txs, t => t.section === 'boleto' || t.section === 'extra');
  return { rec, sai, sobra: rec - sai };
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Finances() {
  const {
    months, transactions, categories, subscriptions, activeMonthId, setActiveMonthId,
    createMonth, closeMonth, reopenMonth, deleteMonth,
    addTransaction, updateTransaction, deleteTransaction,
    addSubscription, deleteSubscription,
  } = useFinance();
  const { toast } = useToast();

  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isSubsModalOpen, setIsSubsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [addSection, setAddSection] = useState<FinanceSection | null>(null);
  const [editTx, setEditTx] = useState<FinanceTransaction | null>(null);
  const [monthToDelete, setMonthToDelete] = useState<string | null>(null);
  const [highlightTxId, setHighlightTxId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FinanceSection>('boleto');
  const [query, setQuery] = useState('');
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const [futureMonthKey, setFutureMonthKey] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Linhas que acabaram de mudar de status ficam "presas" no grupo atual por
  // 2,5s com destaque visual, antes de migrar para o outro grupo.
  const [pinnedGroup, setPinnedGroup] = useState<Record<string, 'acao' | 'resolvido'>>({});
  const pinTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const realSortedMonths = useMemo(() => [...months].sort((a, b) => a.month.localeCompare(b.month)), [months]);
  const monthsDesc = useMemo(() => [...months].sort((a, b) => b.month.localeCompare(a.month)), [months]);
  const activeMonth = useMemo(() => months.find(m => m.id === activeMonthId), [months, activeMonthId]);
  const currentIndex = useMemo(() => realSortedMonths.findIndex(m => m.id === activeMonthId), [realSortedMonths, activeMonthId]);
  const latestRealMonth = realSortedMonths[realSortedMonths.length - 1];

  const monthTxs = useMemo(() => transactions.filter(t => t.monthId === activeMonthId), [transactions, activeMonthId]);
  const prevRealMonth = currentIndex > 0 ? realSortedMonths[currentIndex - 1] : null;
  const prevMonthTxs = useMemo(
    () => prevRealMonth ? transactions.filter(t => t.monthId === prevRealMonth.id) : [],
    [transactions, prevRealMonth]
  );

  const { rec: totalIncome, sai: totalExp, sobra: balance } = sobraDe(monthTxs);
  const totalBoletos = sumBy(monthTxs, t => t.section === 'boleto');
  const totalExtras = sumBy(monthTxs, t => t.section === 'extra');
  const totalSubs = subscriptions.reduce((a, s) => a + s.value, 0);
  const burnPct = totalIncome > 0 ? Math.min(100, Math.round((totalExp / totalIncome) * 100)) : 0;

  const prev = prevRealMonth ? sobraDe(prevMonthTxs) : null;
  const sobraDelta = prev ? balance - prev.sobra : null;
  const recDeltaPct = prev && prev.rec > 0 ? ((totalIncome - prev.rec) / prev.rec) * 100 : null;
  const saiDeltaPct = prev && prev.sai > 0 ? ((totalExp - prev.sai) / prev.sai) * 100 : null;

  const impostos = useMemo(() => monthTxs.filter(t => (t.category || '').toLowerCase() === 'impostos'), [monthTxs]);
  const totalImpostos = sumBy(impostos, () => true);

  const pendentes = useMemo(
    () => monthTxs.filter(t => t.section === 'boleto' && needsAction(t.paymentStatus)),
    [monthTxs]
  );
  const totalPendente = sumBy(pendentes, () => true);
  const recResolvidos = monthTxs.filter(t => t.section === 'boleto' && !needsAction(t.paymentStatus)).length;
  const recTotal = monthTxs.filter(t => t.section === 'boleto').length;

  // "Para onde foi o dinheiro": quando a fatura foi importada em detalhe
  // (seção cartao), o gráfico abre o cartão por categoria e ESCONDE o bloco
  // único "Cartão Crédito" do boleto — senão o mesmo dinheiro apareceria
  // duas vezes. O fluxo de caixa (Sobra/Saídas) não muda: cartao não soma lá.
  const hasCardItems = useMemo(() => monthTxs.some(t => t.section === 'cartao'), [monthTxs]);
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    monthTxs
      .filter(t => t.section === 'boleto' || t.section === 'extra' || t.section === 'cartao')
      .filter(t => !(hasCardItems && t.section === 'boleto' && isCardCategory(t.category)))
      .forEach(t => {
        const cat = t.category || 'Outro';
        map.set(cat, (map.get(cat) ?? 0) + t.value);
      });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [monthTxs, hasCardItems]);
  const maxCat = categoryTotals[0]?.[1] ?? 1;
  const chartTotal = categoryTotals.reduce((s, [, v]) => s + v, 0);

  const visiveis = useMemo(() => {
    const q = query.trim().toLowerCase();
    return monthTxs
      .filter(t => t.section === filter)
      .filter(t => !q || t.description.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const pa = needsAction(a.paymentStatus) ? 0 : 1;
        const pb = needsAction(b.paymentStatus) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (a.dueDay ?? 99) - (b.dueDay ?? 99);
      });
  }, [monthTxs, filter, query]);

  const groupOf = useCallback((t: FinanceTransaction): 'acao' | 'resolvido' =>
    pinnedGroup[t.id] ?? (needsAction(t.paymentStatus) ? 'acao' : 'resolvido'),
  [pinnedGroup]);

  const aPagar = visiveis.filter(t => groupOf(t) === 'acao');
  const demais = visiveis.filter(t => groupOf(t) === 'resolvido');

  const countBy = (f: FinanceSection) => monthTxs.filter(t => t.section === f).length;

  // ── Navegação de mês ──
  const goPrev = () => {
    if (futureMonthKey) { setFutureMonthKey(null); return; }
    if (currentIndex > 0) setActiveMonthId(realSortedMonths[currentIndex - 1].id);
  };
  const goNext = () => {
    if (futureMonthKey) return;
    if (currentIndex >= 0 && currentIndex < realSortedMonths.length - 1) {
      setActiveMonthId(realSortedMonths[currentIndex + 1].id);
    } else if (latestRealMonth) {
      setFutureMonthKey(addMonthsToStr(latestRealMonth.month, 1));
    }
  };
  const canGoPrev = !!futureMonthKey || currentIndex > 0;
  const canGoNext = !futureMonthKey;

  // ── Status: seleção direta via menu (sem ciclar) ──
  const setStatusTo = (tx: FinanceTransaction, novo: FinancePaymentStatus) => {
    setStatusMenuFor(null);
    if (tx.paymentStatus === novo) return;

    const grupoAtual: 'acao' | 'resolvido' = pinnedGroup[tx.id] ?? (needsAction(tx.paymentStatus) ? 'acao' : 'resolvido');
    setPinnedGroup(p => ({ ...p, [tx.id]: grupoAtual }));
    if (pinTimers.current[tx.id]) clearTimeout(pinTimers.current[tx.id]);
    pinTimers.current[tx.id] = setTimeout(() => {
      setPinnedGroup(p => {
        const { [tx.id]: _drop, ...rest } = p;
        return rest;
      });
      delete pinTimers.current[tx.id];
    }, 2500);

    updateTransaction(tx.id, {
      paymentStatus: novo,
      notes: tx.paymentStatus === 'previsto' ? undefined : tx.notes,
    });
  };

  useEffect(() => () => {
    Object.values(pinTimers.current).forEach(clearTimeout);
  }, []);

  // ── Import via modal "Personalizar…" (fluxo existente) ──
  const handleImportAndCreate = (monthStr: string, selectedTxIds: string[]) => {
    const newMonth = createMonth(monthStr);
    if (selectedTxIds.length > 0) {
      const toCopy = transactions.filter(t => selectedTxIds.includes(t.id));
      toCopy.forEach(t => {
        const { id, createdAt, monthId, ...rest } = t;
        addTransaction({
          ...rest,
          monthId: newMonth.id,
          date: shiftDateToMonth(t.date, monthStr),
          paymentStatus: t.section === 'boleto' ? 'pending' : t.paymentStatus,
        });
      });
      toast(`Mês criado com ${selectedTxIds.length} lançamento(s) importado(s)`);
    } else {
      toast('Novo mês criado com sucesso');
    }
    setIsMonthModalOpen(false);
    setFutureMonthKey(null);
  };

  // ── Materialização do mês seguinte (navegação por seta) ──
  // Itens de cartão são históricos (compras da fatura passada): não repetem
  const recorrentesDoUltimoMes = useMemo(
    () => latestRealMonth ? transactions.filter(t => t.monthId === latestRealMonth.id && t.section !== 'extra' && t.section !== 'cartao') : [],
    [transactions, latestRealMonth]
  );

  const criarFuturoComRecorrentes = () => {
    if (!futureMonthKey || !latestRealMonth) return;
    const newMonth = createMonth(futureMonthKey);
    recorrentesDoUltimoMes.forEach(t => {
      const { id, createdAt, monthId, ...rest } = t;
      const baseDate = shiftDateToMonth(t.date, futureMonthKey);

      if (t.paymentStatus === 'auto_debit') {
        addTransaction({ ...rest, monthId: newMonth.id, date: baseDate });
        return;
      }
      if (t.section === 'boleto' && isCardCategory(t.category)) {
        const avg = avgForCategoryAcrossMonths(t.category!, transactions, monthsDesc, latestRealMonth.id);
        addTransaction({
          ...rest, monthId: newMonth.id, date: baseDate,
          value: avg != null ? Math.round(avg * 100) / 100 : t.value,
          paymentStatus: 'previsto',
          notes: 'Valor estimado pela média dos últimos meses — confirme quando a fatura fechar.',
        });
        return;
      }
      addTransaction({
        ...rest, monthId: newMonth.id, date: baseDate,
        paymentStatus: t.section === 'income' ? undefined : 'pending',
        notes: undefined,
      });
    });
    toast(`${fmtMonth(futureMonthKey)} criado com ${recorrentesDoUltimoMes.length} lançamento(s) recorrente(s)`);
    setFutureMonthKey(null);
  };

  const criarFuturoVazio = () => {
    if (!futureMonthKey) return;
    createMonth(futureMonthKey);
    toast(`${fmtMonth(futureMonthKey)} criado`);
    setFutureMonthKey(null);
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

  // ── Estado vazio: nenhum mês criado ainda ──
  if (months.length === 0) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.title}><Wallet size={22}/> Controle Financeiro</div>
        </header>
        <div className={styles.emptyState}>
          <Wallet size={48}/>
          <h2>Organize suas finanças mensais</h2>
          <p style={{ maxWidth: 400, margin: '0.5rem auto 1rem', lineHeight: 1.6 }}>
            Crie o primeiro mês para começar a registrar seus gastos recorrentes, extras e receitas.
            O InvestMap calcula automaticamente sua sobra e gastos por categoria.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', margin: '1rem 0 1.5rem' }}>
            {[
              { icon: <Receipt size={16}/>, label: 'Recorrentes' },
              { icon: <ShoppingBag size={16}/>, label: 'Extras' },
              { icon: <ArrowDownCircle size={16}/>, label: 'Receitas' },
            ].map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-2)' }}>
                {item.icon} {item.label}
              </span>
            ))}
          </div>
          <button className={styles.btnPrimary} onClick={() => setIsMonthModalOpen(true)}><Plus size={18}/> Criar Primeiro Mês</button>
        </div>
        {isMonthModalOpen && (
          <MonthModal months={monthsDesc} transactions={transactions} onClose={() => setIsMonthModalOpen(false)} onCreate={handleImportAndCreate}/>
        )}
      </div>
    );
  }

  const displayedLabel = futureMonthKey ? fmtMonth(futureMonthKey) : (activeMonth ? fmtMonth(activeMonth.month) : '');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.monthNav}>
          <button className={styles.monthArrow} aria-label="Mês anterior" disabled={!canGoPrev} onClick={goPrev}><ChevronLeft size={17}/></button>
          <div className={styles.monthTitleWrap}>
            <h1 className={styles.monthTitle}>{displayedLabel}</h1>
            <span className={styles.monthMeta}>
              {futureMonthKey ? 'mês ainda não criado' : (
                <>
                  {monthTxs.length} lançamentos
                  <span className={styles.metaDot}> · </span>
                  {activeMonth?.status === 'closed'
                    ? <span className={styles.metaClosed}><Lock size={10}/> fechado</span>
                    : <span className={styles.metaOpen}>em andamento</span>}
                </>
              )}
            </span>
          </div>
          <button className={styles.monthArrow} aria-label="Próximo mês" disabled={!canGoNext} onClick={goNext}><ChevronRight size={17}/></button>
        </div>
        {!futureMonthKey && activeMonth && (
          <div className={styles.headerActions}>
            <button className={styles.btnGhost} onClick={() => activeMonth.status === 'open' ? closeMonth(activeMonth.id) : reopenMonth(activeMonth.id)}>
              {activeMonth.status === 'open' ? <><CheckCircle2 size={15}/> Fechar mês</> : <><Lock size={15}/> Reabrir</>}
            </button>
            <button className={styles.btnGhost} onClick={() => setIsCategoriesModalOpen(true)}><Tags size={15}/> Categorias</button>
            <button className={styles.btnGhost} onClick={() => setMonthToDelete(activeMonth.id)}><Trash2 size={15}/> Excluir Mês</button>
            <button className={styles.btnGhost} disabled={activeMonth.status === 'closed'} onClick={() => setIsImportOpen(true)} title="Lance uma fatura ou nota a partir de uma foto ou PDF">
              <ScanLine size={15}/> Importar com IA
            </button>
            <button className={styles.btnPrimary} disabled={activeMonth.status === 'closed'} onClick={() => setAddSection(filter)}>
              <Plus size={16}/> Novo lançamento
            </button>
          </div>
        )}
      </header>

      {/* ── Mês futuro ainda não criado ── */}
      {futureMonthKey && (
        <section className={styles.newMonthCard}>
          <Sparkles size={36} className={styles.newMonthIcon}/>
          <h2 className={styles.newMonthTitle}>{fmtMonth(futureMonthKey)} ainda não foi criado</h2>
          <p className={styles.newMonthSub}>
            {recorrentesDoUltimoMes.length > 0 ? (
              <>
                Crie o mês já com os <strong>{recorrentesDoUltimoMes.length} lançamentos recorrentes</strong> de {latestRealMonth && fmtMonth(latestRealMonth.month)}.
                Contas fixas voltam <em>pendentes</em>, débitos automáticos são mantidos, e valores variáveis
                — como a fatura do cartão — entram como <strong>≈ previstos</strong> pela média dos últimos
                meses, para você nunca esquecer deles.
              </>
            ) : 'Comece registrando os lançamentos deste mês.'}
          </p>
          <div className={styles.newMonthActions}>
            {recorrentesDoUltimoMes.length > 0 && (
              <button className={styles.btnPrimary} onClick={criarFuturoComRecorrentes}>
                <Sparkles size={15}/> Criar com recorrentes ({recorrentesDoUltimoMes.length})
              </button>
            )}
            <button className={recorrentesDoUltimoMes.length > 0 ? styles.btnGhost : styles.btnPrimary} onClick={criarFuturoVazio}>
              Começar do zero
            </button>
            <button className={styles.btnGhost} onClick={() => setIsMonthModalOpen(true)}>Personalizar…</button>
          </div>
        </section>
      )}

      {!futureMonthKey && activeMonth && (
        <>
          {/* ── Hero ── */}
          <section className={styles.hero} aria-label="Resumo do mês">
            <div className={styles.tile}>
              <span className={styles.tileLabel}>Sobra do mês</span>
              <span className={styles.heroValue} style={{ color: balance >= 0 ? '#10B981' : '#EF4444' }}>{fmt(balance)}</span>
              {sobraDelta !== null && prevRealMonth && (
                <span className={styles.delta}>
                  <span className={sobraDelta >= 0 ? styles.deltaGood : styles.deltaBad}>
                    {sobraDelta >= 0 ? '▲' : '▼'} {fmt(Math.abs(sobraDelta))}
                  </span>
                  <span className={styles.deltaRef}>vs {MONTH_SHORT[parseInt(prevRealMonth.month.split('-')[1]) - 1]}</span>
                </span>
              )}
              <div className={styles.meterWrap}>
                <div className={styles.meterLabelRow}>
                  <span>Você usou {burnPct}% das entradas</span>
                  <span>{fmt(totalExp)} de {fmt(totalIncome)}</span>
                </div>
                <div className={styles.meterTrack} role="img" aria-label={`Gastos consumiram ${burnPct}% das entradas`}>
                  <div className={styles.meterFill} style={{ width: `${burnPct}%` }} />
                </div>
              </div>
            </div>

            <div className={styles.tile}>
              <span className={styles.tileLabel}>Entradas</span>
              <span className={styles.tileValue} style={{ color: '#10B981' }}>{fmt(totalIncome)}</span>
              {recDeltaPct !== null && prevRealMonth && (
                <span className={styles.delta}>
                  <span className={recDeltaPct >= 0 ? styles.deltaGood : styles.deltaBad}>
                    {recDeltaPct >= 0 ? '▲' : '▼'} {Math.abs(recDeltaPct).toFixed(1).replace('.', ',')}%
                  </span>
                  <span className={styles.deltaRef}>vs {MONTH_SHORT[parseInt(prevRealMonth.month.split('-')[1]) - 1]}</span>
                </span>
              )}
              <span className={styles.tileSub}>Receitas do mês</span>
            </div>

            <div className={styles.tile}>
              <span className={styles.tileLabel}>Saídas</span>
              <span className={styles.tileValue}>{fmt(totalExp)}</span>
              {saiDeltaPct !== null && prevRealMonth && (
                <span className={styles.delta}>
                  <span className={saiDeltaPct <= 0 ? styles.deltaGood : styles.deltaBad}>
                    {saiDeltaPct >= 0 ? '▲' : '▼'} {Math.abs(saiDeltaPct).toFixed(1).replace('.', ',')}%
                  </span>
                  <span className={styles.deltaRef}>vs {MONTH_SHORT[parseInt(prevRealMonth.month.split('-')[1]) - 1]}</span>
                </span>
              )}
              <span className={styles.tileSub}>Recorrentes {fmt(totalBoletos)} · Extras {fmt(totalExtras)}</span>
            </div>
          </section>

          {/* ── Faixa acionável ── */}
          {pendentes.length > 0 && (
            <section className={styles.dueStrip} aria-label="Contas a pagar">
              <CalendarClock size={18} color="#F59E0B" style={{ flexShrink: 0 }}/>
              <div className={styles.dueHead}>
                <span className={styles.dueTitle}>{pendentes.length} conta{pendentes.length !== 1 ? 's' : ''} a pagar · {fmt(totalPendente)}</span>
                <span className={styles.dueSum}>{recResolvidos} de {recTotal} recorrentes já resolvidos</span>
              </div>
              <div className={styles.dueChips}>
                {[...pendentes].sort((a, b) => (a.dueDay ?? 0) - (b.dueDay ?? 0)).map(t => (
                  <button key={t.id} className={styles.dueChip} title={`Ver ${t.description}`} onClick={() => setEditTx(t)}>
                    <span className={styles.dueChipDay}>{t.dueDay ? `Dia ${t.dueDay}` : '—'}</span>
                    {t.description}{t.paymentStatus === 'previsto' && ' ≈'}
                    <span className={styles.dueChipVal}>{fmt(t.value)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Grid principal ── */}
          <div className={styles.mainGrid}>
            <section className={styles.card} aria-label="Lançamentos do mês">
              <div className={styles.toolbar}>
                <div className={styles.filterGroups}>
                  <div className={styles.filterGroup}>
                    <span className={`${styles.filterGroupLabel} ${styles.labelOut}`}><ArrowDownCircle size={11}/> Saídas</span>
                    <div className={styles.segmented} role="tablist" aria-label="Filtrar saídas">
                      <button role="tab" aria-selected={filter === 'boleto'} className={`${styles.segBtn} ${filter === 'boleto' ? styles.segActive : ''}`} onClick={() => setFilter('boleto')}>
                        Recorrentes<span className={styles.segCount}>{countBy('boleto')}</span>
                      </button>
                      <button role="tab" aria-selected={filter === 'extra'} className={`${styles.segBtn} ${filter === 'extra' ? styles.segActive : ''}`} onClick={() => setFilter('extra')}>
                        Extras<span className={styles.segCount}>{countBy('extra')}</span>
                      </button>
                      <button role="tab" aria-selected={filter === 'cartao'} className={`${styles.segBtn} ${filter === 'cartao' ? styles.segActive : ''}`} onClick={() => setFilter('cartao')}>
                        Cartão<span className={styles.segCount}>{countBy('cartao')}</span>
                      </button>
                    </div>
                  </div>
                  <div className={styles.filterGroup}>
                    <span className={`${styles.filterGroupLabel} ${styles.labelIn}`}><ArrowUpCircle size={11}/> Entradas</span>
                    <div className={styles.segmented} role="tablist" aria-label="Filtrar entradas">
                      <button role="tab" aria-selected={filter === 'income'} className={`${styles.segBtn} ${filter === 'income' ? styles.segActiveIn : ''}`} onClick={() => setFilter('income')}>
                        Receitas<span className={styles.segCount}>{countBy('income')}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <input className={styles.search} placeholder="Buscar lançamento…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar lançamento"/>
              </div>

              {visiveis.length === 0 && (
                filter === 'cartao' && countBy('cartao') === 0 ? (
                  <div className={styles.emptyRow2}>
                    <p style={{ margin: '0 0 0.8rem' }}>
                      Aqui ficam as compras que compõem a fatura do cartão — elas não somam nas
                      saídas (quem soma é a fatura, nos Recorrentes), mas mostram para onde foi o dinheiro.
                    </p>
                    <button className={styles.btnPrimary} disabled={activeMonth?.status === 'closed'} onClick={() => setIsImportOpen(true)}>
                      <ScanLine size={16}/> Importar fatura com IA
                    </button>
                  </div>
                ) : (
                  <p className={styles.emptyRow2}>
                    {monthTxs.filter(t => t.section === filter).length === 0
                      ? 'Nenhum lançamento nesta seção — adicione o primeiro.'
                      : `Nenhum lançamento encontrado${query ? ` para "${query}"` : ''}.`}
                  </p>
                )
              )}

              {aPagar.length > 0 && <div className={styles.groupLabel}>A pagar ({aPagar.length})</div>}
              {aPagar.map(t => (
                <Row key={t.id} tx={t} highlighted={highlightTxId === t.id} changed={!!pinnedGroup[t.id]}
                  subsCount={subscriptions.length} menuOpen={statusMenuFor === t.id}
                  onToggleMenu={() => setStatusMenuFor(prev => prev === t.id ? null : t.id)}
                  onPickStatus={(status) => setStatusTo(t, status)}
                  onEdit={() => setEditTx(t)}
                  onDelete={() => { deleteTransaction(t.id); toast('Lançamento removido'); }}
                  onShowSubs={() => setIsSubsModalOpen(true)}
                />
              ))}

              {demais.length > 0 && aPagar.length > 0 && <div className={styles.groupLabel}>Resolvidos e demais ({demais.length})</div>}
              {demais.map(t => (
                <Row key={t.id} tx={t} highlighted={highlightTxId === t.id} changed={!!pinnedGroup[t.id]}
                  subsCount={subscriptions.length} menuOpen={statusMenuFor === t.id}
                  onToggleMenu={() => setStatusMenuFor(prev => prev === t.id ? null : t.id)}
                  onPickStatus={(status) => setStatusTo(t, status)}
                  onEdit={() => setEditTx(t)}
                  onDelete={() => { deleteTransaction(t.id); toast('Lançamento removido'); }}
                  onShowSubs={() => setIsSubsModalOpen(true)}
                />
              ))}
            </section>

            {/* Sidebar analítica */}
            <aside className={styles.sidebar}>
              <div className={styles.sideCard}>
                <h2 className={styles.sideTitle}>Para onde foi o dinheiro</h2>
                <p className={styles.sideSub}>
                  {hasCardItems
                    ? 'Saídas por categoria, com a fatura do cartão aberta compra a compra'
                    : 'Saídas do mês por categoria'}
                </p>
                {categoryTotals.length === 0 && <p className={styles.sideSub}>Sem saídas ainda.</p>}
                {categoryTotals.map(([nome, valor]) => {
                  const Icon = iconForCategory(nome);
                  return (
                    <div key={nome} className={styles.catRow}>
                      <div className={styles.catLabelRow}>
                        <span className={styles.catName}><span className={styles.catIcon}><Icon size={13} strokeWidth={1.8}/></span>{nome}</span>
                        <span className={styles.catVal}>{fmt(valor)}<span className={styles.catPct}>{chartTotal > 0 ? ((valor / chartTotal) * 100).toFixed(0) : 0}%</span></span>
                      </div>
                      <div className={styles.catTrack}><div className={styles.catFill} style={{ width: `${(valor / maxCat) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>

              <div className={`${styles.sideCard} ${styles.subsCard}`}>
                <h2 className={styles.sideTitle}><CreditCard size={15} style={{ verticalAlign: -2 }}/> Monitor de assinaturas</h2>
                <div className={styles.subsTotalRow}><span className={styles.subsTotal}>{fmt(totalSubs)}<span className={styles.subsPerMonth}>/mês</span></span></div>
                <p className={styles.sideSub} style={{ marginBottom: '0.4rem' }}>Vivem dentro da fatura do cartão e se repetem todo mês — até você alterar.</p>
                {subscriptions.slice(0, 3).map(sub => {
                  const Icon = iconForCategory(sub.category);
                  return (
                    <div key={sub.id} className={styles.subsItem}>
                      <span className={styles.subsItemName}><Icon size={13} strokeWidth={1.8}/> {sub.description}</span>
                      <strong>{fmt(sub.value)}</strong>
                    </div>
                  );
                })}
                <button className={styles.subsManageBtn} onClick={() => setIsSubsModalOpen(true)}>Gerenciar assinaturas ({subscriptions.length})</button>
              </div>

              {totalImpostos > 0 && (
                <div className={styles.sideCard}>
                  <h2 className={styles.sideTitle}>Impostos do mês</h2>
                  <div className={styles.taxRow}>
                    <div className={styles.taxBadge}><Receipt size={18} strokeWidth={1.8}/></div>
                    <div>
                      <div className={styles.taxVal}>{fmt(totalImpostos)}</div>
                      <div className={styles.taxSub}>já contados nos recorrentes</div>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      {/* Modals */}
      {monthToDelete && (
        <DeleteMonthModal
          monthName={fmtMonth(months.find(m => m.id === monthToDelete)?.month || '')}
          onClose={() => setMonthToDelete(null)}
          onConfirm={() => { deleteMonth(monthToDelete); setMonthToDelete(null); }}
        />
      )}
      {isMonthModalOpen && (
        <MonthModal months={monthsDesc} transactions={transactions} onClose={() => setIsMonthModalOpen(false)} onCreate={handleImportAndCreate}/>
      )}
      {isCategoriesModalOpen && <CategoriesModal onClose={() => setIsCategoriesModalOpen(false)}/>}
      {isSubsModalOpen && (
        <SubscriptionsModal
          subscriptions={subscriptions}
          categories={categories.map(c => c.name)}
          onClose={() => setIsSubsModalOpen(false)}
          onAdd={addSubscription}
          onRemove={(id) => { deleteSubscription(id); toast('Assinatura removida'); }}
        />
      )}
      {isImportOpen && activeMonth && (
        <FinanceImportModal
          monthId={activeMonth.id}
          monthStr={activeMonth.month}
          categories={categories.map(c => c.name)}
          monthTxs={monthTxs}
          allTransactions={transactions}
          onClose={() => setIsImportOpen(false)}
          onConfirm={(list) => {
            list.forEach(addTransaction);
            toast(`${list.length} lançamento${list.length !== 1 ? 's' : ''} adicionado${list.length !== 1 ? 's' : ''} via importação`);
            setIsImportOpen(false);
          }}
        />
      )}
      {addSection && activeMonthId && (
        <TxModal section={addSection} monthId={activeMonthId} onClose={() => setAddSection(null)}
          onSave={(data) => { addTransaction(data); toast('Lançamento adicionado com sucesso'); setAddSection(null); }}/>
      )}
      {editTx && (
        <TxModal section={editTx.section} monthId={editTx.monthId} existing={editTx}
          onClose={() => setEditTx(null)}
          onSave={(data) => { updateTransaction(editTx.id, data as Partial<FinanceTransaction>); toast('Lançamento atualizado com sucesso'); setEditTx(null); }}/>
      )}
    </div>
  );
}

// ─── Linha da lista ──────────────────────────────────────────────────────────
function Row({ tx, highlighted, changed, subsCount, menuOpen, onToggleMenu, onPickStatus, onEdit, onDelete, onShowSubs }: {
  tx: FinanceTransaction;
  highlighted: boolean;
  changed: boolean;
  subsCount: number;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onPickStatus: (status: FinancePaymentStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowSubs: () => void;
}) {
  const isIncome = tx.section === 'income';
  const isCard = isCardCategory(tx.category);
  const Icon = iconForCategory(tx.category);

  return (
    <div id={`tx-row-${tx.id}`} className={`${styles.row} ${changed ? styles.rowChanged : ''} ${highlighted ? styles.rowHighlight2 : ''}`}>
      <div className={styles.rowIcon} aria-hidden><Icon size={16} strokeWidth={1.8}/></div>
      <div className={styles.rowBody}>
        <div className={styles.rowDesc}>{tx.description}</div>
        <div className={styles.rowMeta}>
          <span>{tx.category || 'Sem categoria'}</span>
          {tx.dueDay && <><span className={styles.metaDot}>·</span><span>Dia {tx.dueDay}</span></>}
          {isCard && subsCount > 0 && (
            <>
              <span className={styles.metaDot}>·</span>
              <button className={styles.cardTagBtn} onClick={onShowSubs}>{subsCount} assinatura{subsCount !== 1 ? 's' : ''} dentro</button>
            </>
          )}
          {tx.notes && <><span className={styles.metaDot}>·</span><span className={styles.noteTag}>{tx.notes}</span></>}
        </div>
      </div>
      <div className={styles.rowRight}>
        <div className={styles.rowActions}>
          <button className={styles.editBtn2} onClick={onEdit} title="Editar" aria-label={`Editar ${tx.description}`}><Edit2 size={14}/></button>
          <button className={styles.delBtn2} onClick={onDelete} title="Excluir" aria-label={`Excluir ${tx.description}`}><Trash2 size={14}/></button>
        </div>
        <span className={`${styles.rowValue} ${isIncome ? styles.incomeValue : ''}`}>{isIncome ? '+' : ''}{fmt(tx.value)}</span>
        {tx.paymentStatus ? (
          <div className={styles.statusWrap}>
            <button className={`${styles.statusPill} ${STATUS_CSS[tx.paymentStatus]}`} onClick={onToggleMenu} aria-haspopup="menu" aria-expanded={menuOpen}>
              {STATUS_LABELS[tx.paymentStatus]}
            </button>
            {menuOpen && (
              <>
                <div className={styles.statusBackdrop} onClick={onToggleMenu} aria-hidden />
                <div className={styles.statusMenu} role="menu" aria-label={`Status de ${tx.description}`}>
                  {STATUS_OPTIONS.map(opt => (
                    <button key={opt} role="menuitemradio" aria-checked={tx.paymentStatus === opt}
                      className={`${styles.statusOption} ${tx.paymentStatus === opt ? styles.statusOptionActive : ''}`}
                      onClick={() => onPickStatus(opt)}>
                      <span className={`${styles.statusDot} ${STATUS_CSS[opt]}`} aria-hidden />
                      {STATUS_LABELS[opt].replace(/^[^ ]+ /, '')}
                      {tx.paymentStatus === opt && <span className={styles.statusCheck}>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <span className={`${styles.statusPill} ${styles.statusNone}`} aria-hidden>—</span>
        )}
      </div>
    </div>
  );
}

// ─── Modal: Monitor de assinaturas ────────────────────────────────────────────
function SubscriptionsModal({ subscriptions, categories, onClose, onAdd, onRemove }: {
  subscriptions: FinanceSubscription[];
  categories: string[];
  onClose: () => void;
  onAdd: (data: Omit<FinanceSubscription, 'id' | 'createdAt'>) => void;
  onRemove: (id: string) => void;
}) {
  const [newDesc, setNewDesc] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCat, setNewCat] = useState(categories[0] || '');
  const total = subscriptions.reduce((a, s) => a + s.value, 0);

  const handleAdd = () => {
    const num = parseFloat(newValue.replace(/\./g, '').replace(',', '.'));
    if (!newDesc.trim() || isNaN(num) || num <= 0) return;
    onAdd({ description: newDesc.trim(), category: newCat || undefined, value: num });
    setNewDesc('');
    setNewValue('');
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Monitor de assinaturas">
        <div className={styles.modalHead}>
          <h3><CreditCard size={17} style={{ verticalAlign: -3 }}/> Monitor de assinaturas</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar"><X size={20}/></button>
        </div>
        <div className={styles.modalBody}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-2)', lineHeight: 1.55, margin: 0 }}>
            Cobranças que se repetem todo mês <strong>dentro da fatura do cartão</strong> — não somam
            como gasto separado. Elas <strong>continuam nos próximos meses automaticamente</strong>;
            só mudam quando você adiciona ou remove uma aqui.
          </p>

          <div className={styles.subsList}>
            {subscriptions.map(sub => (
              <div key={sub.id} className={styles.subsModalRow}>
                <span className={styles.subsModalDesc}>{sub.description}{sub.category ? ` · ${sub.category}` : ''}</span>
                <strong className={styles.subsModalVal}>{fmt(sub.value)}</strong>
                <button className={styles.delBtn2} onClick={() => onRemove(sub.id)} title="Cancelar assinatura" aria-label={`Remover ${sub.description}`}>
                  <Trash2 size={13}/>
                </button>
              </div>
            ))}
            {subscriptions.length === 0 && <p style={{ color: 'var(--color-text-2)', fontSize: '0.85rem', margin: '0.5rem 0' }}>Nenhuma assinatura cadastrada.</p>}
          </div>

          <div className={styles.subsAddForm}>
            <input className={styles.input} placeholder="Nova assinatura (ex.: Disney+)" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ flex: 2, minWidth: 0 }}/>
            <input className={styles.input} placeholder="R$" inputMode="decimal" value={newValue} onChange={e => setNewValue(e.target.value)} style={{ flex: 1, minWidth: 0 }}/>
            {categories.length > 0 && (
              <select className={styles.input} value={newCat} onChange={e => setNewCat(e.target.value)} style={{ flex: 1.4, minWidth: 0 }}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <button className={styles.btnPrimary} onClick={handleAdd} style={{ padding: '0.5rem 0.9rem' }} aria-label="Adicionar assinatura"><Plus size={15}/></button>
          </div>

          <div className={styles.subsModalTotal}><span>Total por mês</span><strong>{fmt(total)}</strong></div>
          <div className={styles.subsModalTotal} style={{ opacity: 0.75 }}><span>Custo por ano</span><strong>{fmt(total * 12)}</strong></div>
        </div>
      </div>
    </div>
  );
}

// ─── Month Modal (import "Personalizar…") ────────────────────────────────────
const SECTION_LABELS_IMPORT: Record<string, string> = { boleto: 'Recorrentes', income: 'Receitas', extra: 'Gastos Extras' };
const SECTION_ORDER = ['boleto', 'income', 'extra'];

function MonthModal({
  months, transactions, onClose, onCreate
}: {
  months: { id: string; month: string }[];
  transactions: FinanceTransaction[];
  onClose: () => void;
  onCreate: (v: string, selectedTxIds: string[]) => void;
}) {
  const now = new Date();
  const suggestNext = useCallback(() => {
    const existingMonths = new Set(months.map(m => m.month));
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    for (let i = 0; i < 24; i++) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (!existingMonths.has(key)) return { year, month };
      month++;
      if (month > 12) { month = 1; year++; }
    }
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  const suggested = useMemo(() => suggestNext(), [suggestNext]);
  const [selYear, setSelYear] = useState(suggested.year);
  const [selMonth, setSelMonth] = useState(suggested.month);
  const [importFrom, setImportFrom] = useState<string>('none');
  const [step, setStep] = useState<'config' | 'select'>('config');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const monthStr = `${selYear}-${String(selMonth).padStart(2, '0')}`;
  const alreadyExists = months.some(m => m.month === monthStr);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 5 }, (_, i) => y - 1 + i);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importableTxs = useMemo(() => {
    if (importFrom === 'none') return [];
    return transactions.filter(t => t.monthId === importFrom && (t.section === 'boleto' || t.section === 'income' || t.section === 'extra'));
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
    if (importFrom === 'none') { onCreate(monthStr, []); return; }
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

  const toggleCollapsed = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  };

  const handleCreate = () => onCreate(monthStr, Array.from(selectedIds));
  const fmt2 = fmt;

  if (step === 'select') {
    const totalSelected = importableTxs.filter(t => selectedIds.has(t.id)).reduce((s, t) => s + t.value, 0);

    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modalFlex} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className={styles.modalHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button className={styles.closeBtn} onClick={() => setStep('config')} title="Voltar" aria-label="Voltar" style={{ marginRight: 0 }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h3 style={{ margin: 0 }}>Selecionar Lançamentos</h3>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar"><X size={20}/></button>
          </div>

          <div className={styles.modalScrollBody}>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-2)', margin: 0, lineHeight: 1.5 }}>
              Importando de <strong style={{ color: 'var(--color-text)' }}>{fmtMonth(months.find(m => m.id === importFrom)?.month || '')}</strong> → <strong style={{ color: 'var(--color-text)' }}>{MONTH_NAMES[selMonth - 1]} {selYear}</strong>
            </p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className={styles.btnPrimary} style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }} onClick={() => setSelectedIds(new Set(importableTxs.map(t => t.id)))}>Selecionar todos</button>
              <button type="button" className={styles.btnGhost} style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }} onClick={() => setSelectedIds(new Set())}>Limpar seleção</button>
            </div>

            {SECTION_ORDER.filter(s => grouped[s]?.length).map(section => {
              const txs = grouped[section];
              const allSel = txs.every(t => selectedIds.has(t.id));
              const someSel = txs.some(t => selectedIds.has(t.id));
              const isOpen = !collapsedSections.has(section);
              const selCount = txs.filter(t => selectedIds.has(t.id)).length;

              return (
                <div key={section} className={styles.importGroup}>
                  <div className={styles.importGroupHeader}>
                    <input type="checkbox" checked={allSel} ref={el => { if (el) el.indeterminate = !allSel && someSel; }} onChange={() => toggleSection(section)} onClick={e => e.stopPropagation()} className={styles.importCheck}/>
                    <button type="button" className={styles.importGroupCollapse} onClick={() => toggleCollapsed(section)} aria-expanded={isOpen}>
                      <span className={styles.importGroupLabel}>{SECTION_LABELS_IMPORT[section]}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
                        <span className={styles.importGroupCount} style={{ background: selCount > 0 ? 'var(--color-primary-subtle, rgba(139,92,246,0.15))' : undefined, color: selCount > 0 ? 'var(--color-primary-light)' : undefined }}>{selCount}/{txs.length}</span>
                        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', color: 'var(--color-text-3, #666)', flexShrink: 0 }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </button>
                  </div>
                  <div className={styles.importGroupItems} style={{ display: isOpen ? 'block' : 'none' }}>
                    {txs.map(tx => (
                      <label key={tx.id} className={styles.importRow}>
                        <input type="checkbox" checked={selectedIds.has(tx.id)} onChange={() => toggleId(tx.id)} className={styles.importCheck}/>
                        <span className={styles.importDesc}>{tx.description}</span>
                        <span className={styles.importVal}>{fmt2(tx.value)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {importableTxs.length === 0 && <p style={{ color: 'var(--color-text-2)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>Nenhum lançamento disponível neste mês.</p>}
          </div>

          <div className={styles.modalFooter}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedIds.size} lançamento{selectedIds.size !== 1 ? 's' : ''}</div>
              {selectedIds.size > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-2)', marginTop: '0.1rem' }}>{fmt2(totalSelected)}</div>}
            </div>
            <button type="button" className={styles.submitBtn} style={{ margin: 0, padding: '0.6rem 1.5rem' }} onClick={handleCreate}>Criar Mês</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHead}>
          <h3>Novo Mês de Controle</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar"><X size={20}/></button>
        </div>
        <form className={styles.modalBody} onSubmit={handleGoToSelect}>
          <div className={styles.formGroup}>
            <label>Mês / Ano</label>
            <div className={styles.monthYearPicker}>
              <select className={styles.input} value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
              </select>
              <select className={styles.input} value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {alreadyExists && <span className={styles.inputHint} style={{ color: '#F59E0B' }}>⚠️ Este mês já existe. Escolha outro período.</span>}
          </div>

          {months.length > 0 && (
            <div className={styles.formGroup}>
              <label>Importar lançamentos de</label>
              <select className={styles.input} value={importFrom} onChange={e => setImportFrom(e.target.value)}>
                <option value="none">Não importar</option>
                {months.map(m => <option key={m.id} value={m.id}>{fmtMonth(m.month)}</option>)}
              </select>
              {importFrom !== 'none'
                ? <span className={styles.inputHint}>Você poderá escolher exatamente quais lançamentos importar no próximo passo.</span>
                : <span className={styles.inputHint}>Recorrentes e receitas podem ser copiados com status &quot;Pendente&quot;.</span>}
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={alreadyExists} style={{ opacity: alreadyExists ? 0.5 : 1 }}>
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
  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  const [newCat, setNewCat] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCat.trim()) { addCategory(newCat.trim()); setNewCat(''); }
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) updateCategory(id, editName.trim());
    setEditId(null);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className={styles.modalHead}>
          <h3>Categorias</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar"><X size={20}/></button>
        </div>
        <div className={styles.modalBody} style={{ overflowY: 'auto', padding: '1.5rem' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input required type="text" className={styles.input} style={{ flex: 1 }} value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nova categoria..."/>
            <button type="submit" className={styles.btnPrimary} style={{ padding: '0 1rem' }}><Plus size={18}/></button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sorted.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
                {editId === c.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(c.id); }} style={{ display: 'flex', flex: 1, gap: '0.5rem' }}>
                    <input autoFocus type="text" className={styles.input} style={{ flex: 1, padding: '0.3rem 0.5rem' }} value={editName} onChange={e => setEditName(e.target.value)}/>
                    <button type="submit" className={styles.btnPrimary} style={{ padding: '0 0.75rem' }}>Salvar</button>
                    <button type="button" className={styles.btnGhost} style={{ padding: '0 0.75rem' }} onClick={() => setEditId(null)}>Cancelar</button>
                  </form>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--color-text)' }}>{c.name}</span>
                    <button className={styles.editBtn2} onClick={() => { setEditId(c.id); setEditName(c.name); }}><Edit2 size={15}/></button>
                    <button className={styles.delBtn2} onClick={() => { if (confirm(`Excluir a categoria "${c.name}"?`)) deleteCategory(c.id); }}><Trash2 size={15}/></button>
                  </>
                )}
              </div>
            ))}
            {sorted.length === 0 && <p style={{ color: 'var(--color-text-2)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>Nenhuma categoria.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Month Modal ───────────────────────────────────────────────────────
function DeleteMonthModal({ monthName, onClose, onConfirm }: { monthName: string; onClose: () => void; onConfirm: () => void }) {
  const [val, setVal] = useState('');
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHead}><h3>Excluir Mês</h3><button className={styles.closeBtn} onClick={onClose} aria-label="Fechar"><X size={20}/></button></div>
        <form className={styles.modalBody} onSubmit={e => { e.preventDefault(); if (val === 'EXCLUIR') onConfirm(); }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: '1.5' }}>
            Tem certeza que deseja excluir o mês <strong>{monthName}</strong> e TODOS os seus lançamentos?<br/>Esta ação é permanente.
          </p>
          <div className={styles.formGroup} style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <label>Digite <strong>EXCLUIR</strong> para confirmar</label>
            <input type="text" required className={styles.input} value={val} onChange={e => setVal(e.target.value)} placeholder="EXCLUIR"/>
          </div>
          <button type="submit" className={styles.dangerBtn} style={{ width: '100%', justifyContent: 'center', opacity: val !== 'EXCLUIR' ? 0.5 : 1 }} disabled={val !== 'EXCLUIR'}>
            <Trash2 size={16}/> Excluir Definitivamente
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Transaction Modal (adicionar / editar recorrente, extra, cartão ou receita) ─────
const SECTION_LABELS: Record<'boleto' | 'extra' | 'income' | 'cartao', string> = { boleto: 'Recorrente', extra: 'Gasto Extra', income: 'Receita', cartao: 'Item do Cartão' };
const SECTION_ICONS: Record<'boleto' | 'extra' | 'income' | 'cartao', React.ReactNode> = {
  boleto: <Receipt size={18} style={{ color: '#3B82F6' }}/>,
  extra: <ShoppingBag size={18} style={{ color: '#FF1493' }}/>,
  income: <ArrowDownCircle size={18} style={{ color: '#10B981' }}/>,
  cartao: <CreditCard size={18} style={{ color: '#F59E0B' }}/>,
};

function TxModal({ section, monthId, existing, onClose, onSave }: {
  section: FinanceSection;
  monthId: string;
  existing?: FinanceTransaction;
  onClose: () => void;
  onSave: (data: Omit<FinanceTransaction, 'id' | 'createdAt'>) => void;
}) {
  const { categories } = useFinance();
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  // Lançamentos legados de 'assinatura' não são mais editáveis por esta UI;
  // trata como 'extra' apenas para não quebrar caso um dia surjam aqui.
  const effSection: 'boleto' | 'extra' | 'income' | 'cartao' =
    section === 'boleto' || section === 'income' || section === 'cartao' ? section : 'extra';

  const [desc, setDesc] = useState(existing?.description || '');
  const [value, setValue] = useState(existing?.value ? String(existing.value) : '');
  const [category, setCat] = useState(existing?.category || (sortedCategories[0]?.name || 'Outro'));
  const [dueDay, setDueDay] = useState(existing?.dueDay ? String(existing.dueDay) : '');
  const [cpfCnpj, setCpf] = useState<FinanceCpfCnpj>(existing?.cpfCnpj || 'CPF');
  const [payStatus, setPay] = useState<FinancePaymentStatus>(existing?.paymentStatus || 'pending');
  const defaultDate = existing?.date || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const [date, setDate] = useState(defaultDate);

  const isExpense = effSection !== 'income';
  const isEdit = !!existing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      monthId, type: (isExpense ? 'expense' : 'income') as 'income' | 'expense',
      section: effSection, description: desc, value: parseFloat(value) || 0, date,
      category: isExpense ? category : undefined,
      dueDay: effSection === 'boleto' && dueDay ? parseInt(dueDay) : undefined,
      cpfCnpj: effSection === 'boleto' ? cpfCnpj : undefined,
      paymentStatus: (effSection === 'boleto' || effSection === 'extra') ? payStatus : undefined,
    };
    onSave(data);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHead}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{SECTION_ICONS[effSection]}{isEdit ? `Editar ${SECTION_LABELS[effSection]}` : `Novo ${SECTION_LABELS[effSection]}`}</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar"><X size={20}/></button>
        </div>
        <form className={styles.modalBody} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Descrição</label>
            <input required type="text" className={styles.input} value={desc} placeholder={effSection === 'income' ? 'Ex: Salário, Dividendos...' : 'Ex: Aluguel, Mercado...'} onChange={e => setDesc(e.target.value)}/>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Valor (R$)</label>
              <input required type="number" step="0.01" min="0.01" className={styles.input} value={value} placeholder="0,00" onChange={e => setValue(e.target.value)}/>
            </div>
            <div className={styles.formGroup}>
              <label>Data</label>
              <input required type="date" className={styles.input} value={date} onChange={e => setDate(e.target.value)}/>
            </div>
          </div>
          {isExpense && (
            <div className={styles.formGroup}>
              <label>Categoria</label>
              <select className={styles.input} value={category} onChange={e => setCat(e.target.value)}>
                {sortedCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          )}
          {effSection === 'boleto' && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}><label>Dia de Vencimento</label><input type="number" min="1" max="31" className={styles.input} value={dueDay} placeholder="Ex: 5" onChange={e => setDueDay(e.target.value)}/></div>
              <div className={styles.formGroup}><label>CPF / CNPJ</label><select className={styles.input} value={cpfCnpj} onChange={e => setCpf(e.target.value as FinanceCpfCnpj)}><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></select></div>
            </div>
          )}
          {(effSection === 'boleto' || effSection === 'extra') && (
            <div className={styles.formGroup}>
              <label>Status de Pagamento</label>
              <select className={styles.input} value={payStatus} onChange={e => setPay(e.target.value as FinancePaymentStatus)}>
                <option value="pending">Pendente</option>
                <option value="previsto">≈ Previsto (valor a confirmar)</option>
                <option value="paid">Pago</option>
                <option value="auto_debit">Débito Automático</option>
                <option value="scheduled">Agendado</option>
                <option value="overdue">Atrasado</option>
              </select>
            </div>
          )}
          <button type="submit" className={styles.submitBtn}>{isEdit ? 'Salvar Alterações' : 'Registrar'}</button>
        </form>
      </div>
    </div>
  );
}
