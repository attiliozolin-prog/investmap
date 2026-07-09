'use client';

import { useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useApp } from '@/context/AppContext';
import { useFinance } from '@/context/FinanceContext';
import { calculatePortfolio, formatCurrency, CHART_COLORS } from '@/lib/calculations';
import EvolutionChart from '@/components/EvolutionChart';
import GoalWidget from '@/components/GoalWidget';
import AiAnalysisCard from '@/components/AiAnalysisCard';
import FirstUseTip from '@/components/FirstUseTip';
import styles from './Dashboard.module.css';
import {
  TrendingUp, TrendingDown, RefreshCw, AlertTriangle, CalendarClock,
  Landmark, ShieldAlert, ArrowRight, PieChart, Wallet, ArrowUpRight,
  ArrowDownRight, BarChart3,
} from 'lucide-react';

const AllocationChart = dynamic(() => import('@/components/AllocationChart'), {
  ssr: false,
  loading: () => (
    <div className={styles.card} style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
    </div>
  ),
});

function tickerColor(t: string): string {
  const p = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#0891B2','#9333EA','#65A30D','#C2410C','#0D9488'];
  let h = 0;
  for (let i = 0; i < t.length; i++) h = t.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

export default function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const {
    activeStrategy, activeAssets, saveSnapshot, snapshots, syncPrices,
    isSyncingPrices, lastPriceSyncAt, sellTaxRecords,
  } = useApp();
  const { transactions, months, activeMonthId, subscriptions } = useFinance();

  const summary = useMemo(() => {
    if (!activeStrategy || activeAssets.length === 0) return null;
    try { return calculatePortfolio(activeStrategy, activeAssets); } catch { return null; }
  }, [activeStrategy, activeAssets]);

  // Auto-save snapshot
  useEffect(() => {
    if (summary && activeStrategy && summary.totalValue > 0) {
      const today = new Date().toISOString().split('T')[0];
      const existing = snapshots.find(s => s.strategyId === activeStrategy.id && s.date === today);
      if (existing && existing.totalValue === summary.totalValue && existing.totalInvested === summary.totalInvested) return;
      saveSnapshot({
        date: today, strategyId: activeStrategy.id,
        totalInvested: isNaN(summary.totalInvested) ? 0 : summary.totalInvested,
        totalValue: isNaN(summary.totalValue) ? 0 : summary.totalValue,
        profitLoss: isNaN(summary.profitLoss) ? 0 : summary.profitLoss,
      });
    }
  }, [summary, activeStrategy, saveSnapshot, snapshots]);

  // Boletos próximos (≤7 dias)
  const upcomingBoletos = useMemo(() => {
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    const activeMonth = months.find(m => m.id === activeMonthId);
    if (!activeMonth) return [];
    const [mYear, mMonth] = activeMonth.month.split('-').map(Number);
    const isCurrentMonth = mYear === todayYear && (mMonth - 1) === todayMonth;
    const monthTxs = transactions.filter(t => t.monthId === activeMonthId && t.section === 'boleto');
    const unpaid = monthTxs.filter(t => (t.paymentStatus === 'pending' || t.paymentStatus === 'scheduled') && t.dueDay != null);
    return unpaid.filter(t => {
      const dueDay = t.dueDay!;
      if (isCurrentMonth) return dueDay >= todayDay && dueDay <= todayDay + 7;
      const dueDate = new Date(mYear, mMonth - 1, dueDay);
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
      return diffDays >= 0 && diffDays <= 7;
    }).sort((a, b) => (a.dueDay ?? 0) - (b.dueDay ?? 0));
  }, [transactions, activeMonthId, months]);

  const upcomingTotal = upcomingBoletos.reduce((s, t) => s + t.value, 0);

  // DARFs pendentes
  const pendingDarfs = useMemo(() =>
    sellTaxRecords.filter(r => !r.isLoss && !r.isExempt && r.taxDue > 0 && !r.taxPaid),
  [sellTaxRecords]);
  const pendingDarfTotal = pendingDarfs.reduce((s, r) => s + r.taxDue, 0);

  // Finanças do mês ativo
  const monthSummary = useMemo(() => {
    const mtxs = transactions.filter(t => t.monthId === activeMonthId);
    const income = mtxs.filter(t => t.type === 'income').reduce((s, t) => s + t.value, 0);
    const boletos = mtxs.filter(t => t.section === 'boleto').reduce((s, t) => s + t.value, 0);
    const extras = mtxs.filter(t => t.section === 'extra').reduce((s, t) => s + t.value, 0);
    const subs = subscriptions.reduce((s, sub) => s + sub.value, 0);
    const expense = boletos + extras + subs;
    return { income, boletos, extras, subs, expense, balance: income - expense };
  }, [transactions, activeMonthId, subscriptions]);

  const monthlyCost = monthSummary.expense;
  const activeMonth = months.find(m => m.id === activeMonthId);
  const fmtMonth = (m: string) => {
    const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const [y, mo] = m.split('-');
    return `${names[parseInt(mo) - 1]} ${y}`;
  };

  // Greeting
  const hour = new Date().getHours();
  const greetText = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  // Pre-compute derived values (hooks must be before early returns)
  const categorySummaries = summary?.categorySummaries ?? [];
  const assetsWithCalcs = summary?.assetsWithCalcs ?? [];
  const needsRebalancing = summary?.needsRebalancing ?? false;

  // Class totals for mini alloc bar
  const classTotals = useMemo(() => {
    const map: Record<string, { value: number; color: string }> = {};
    const classNames = Array.from(new Set(categorySummaries.map(c => c.category.className))).sort();
    classNames.forEach((cn, i) => {
      map[cn] = { value: 0, color: CHART_COLORS[i % CHART_COLORS.length] };
    });
    categorySummaries.forEach(cs => {
      if (map[cs.category.className]) map[cs.category.className].value += cs.currentPercent;
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [categorySummaries]);

  // Alloc category colors
  const catColorMap = useMemo(() => {
    const classNames = Array.from(new Set(categorySummaries.map(c => c.category.className))).sort();
    const map: Record<string, string> = {};
    classNames.forEach((cn, i) => { map[cn] = CHART_COLORS[i % CHART_COLORS.length]; });
    return map;
  }, [categorySummaries]);

  // ── Empty states ──
  if (!activeStrategy) {
    return (
      <div className={styles.emptyState}>
        <TrendingUp size={48} style={{ color: 'var(--color-primary-light)' }}/>
        <h3>Nenhuma estratégia encontrada</h3>
        <p>Configure sua estratégia para começar a monitorar seus investimentos.</p>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onNavigate('strategy')}>
          Criar estratégia
        </button>
      </div>
    );
  }

  if (!summary || activeAssets.length === 0) {
    return (
      <div className={styles.emptyState}>
        <TrendingUp size={48} style={{ color: 'var(--color-primary-light)' }}/>
        <h3>Vamos começar sua jornada</h3>
        <p>Adicione seus ativos para ver o dashboard completo.</p>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onNavigate('assets')}>
          Adicionar ativos
        </button>
      </div>
    );
  }

  const buyAssets  = assetsWithCalcs.filter(a => a.action === 'buy');
  const sellAssets = assetsWithCalcs.filter(a => a.action === 'sell');
  const hasAlerts = needsRebalancing || upcomingBoletos.length > 0 || pendingDarfs.length > 0;

  // Top performers (by P&L %)
  const topPerformers = [...assetsWithCalcs]
    .filter(a => !a.isArchived && a.currentValue > 0)
    .sort((a, b) => b.profitLossPercent - a.profitLossPercent)
    .slice(0, 5);

  return (
    <div className={styles.container}>
      {assetsWithCalcs.length > 0 && <FirstUseTip />}

      {/* ── Greeting ── */}
      <div className={styles.greeting}>
        <div className={styles.greetLeft}>
          <h1 className={styles.greetTitle}>{greetText} 👋</h1>
          <span className={styles.greetSub}>
            {activeStrategy.name}
            {lastPriceSyncAt && ` · Preços atualizados ${lastPriceSyncAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </span>
        </div>
        <div className={styles.greetActions}>
          <button className={styles.syncChip} onClick={syncPrices} disabled={isSyncingPrices}>
            <RefreshCw size={13} className={isSyncingPrices ? styles.syncSpin : ''}/> {isSyncingPrices ? 'Atualizando…' : 'Atualizar cotações'}
          </button>
        </div>
      </div>

      {/* ── Hero Row ── */}
      <div className={styles.hero}>
        {/* Patrimônio */}
        <div className={`${styles.tile} ${styles.tileHighlight}`}>
          <span className={styles.tileLabel}>Patrimônio Total</span>
          <span className={styles.heroValue}>{formatCurrency(summary.totalValue)}</span>
          <div className={styles.delta}>
            <span className={summary.profitLoss >= 0 ? styles.deltaGood : styles.deltaBad}>
              {summary.profitLoss >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
              {formatCurrency(Math.abs(summary.profitLoss))}
              {' '}({summary.totalProfitLossPercent >= 0 ? '+' : ''}{summary.totalProfitLossPercent.toFixed(2)}%)
            </span>
            <span className={styles.deltaRef}>vs. investido</span>
          </div>
          <span className={styles.tileSub}>
            Investido: <strong>{formatCurrency(summary.totalInvested)}</strong> · {activeAssets.length} ativos
          </span>
        </div>

        {/* Saúde */}
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Saúde da Carteira</span>
          <div className={styles.healthRow}>
            <span className={styles.healthScore} style={{ color: summary.healthScore >= 80 ? '#10B981' : summary.healthScore >= 50 ? '#FBBF24' : '#F87171' }}>
              {summary.healthScore}
            </span>
            <span className={styles.healthOf}>/ 100</span>
          </div>
          <div className={styles.meterTrack}>
            <div className={styles.meterFill} style={{
              width: `${summary.healthScore}%`,
              background: summary.healthScore >= 80 ? '#10B981' : summary.healthScore >= 50 ? '#FBBF24' : '#F87171',
            }}/>
          </div>
          <span className={styles.tileSub}>
            {summary.healthScore >= 80 ? 'Carteira equilibrada ✓' : needsRebalancing ? 'Rebalanceamento necessário' : 'Próximo ao equilíbrio'}
          </span>
        </div>

        {/* Finanças rápido */}
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Saldo do Mês {activeMonth ? fmtMonth(activeMonth.month) : ''}</span>
          <span className={`${styles.tileValue} ${monthSummary.balance >= 0 ? styles.deltaGood : styles.deltaBad}`}>
            {formatCurrency(monthSummary.balance)}
          </span>
          <span className={styles.tileSub}>
            Receita: <strong>{formatCurrency(monthSummary.income)}</strong>
          </span>
          <span className={styles.tileSub}>
            Despesas: <strong>{formatCurrency(monthSummary.expense)}</strong>
          </span>
        </div>
      </div>

      {/* ── Alerts Strip ── */}
      {hasAlerts && (
        <div className={styles.alertsStrip}>
          {needsRebalancing && (
            <button className={`${styles.alertChip} ${styles.alertRebal}`} onClick={() => onNavigate('assets')}>
              <div className={`${styles.alertIcon} ${styles.alertIconRebal}`}><AlertTriangle size={17}/></div>
              <div className={styles.alertBody}>
                <div className={styles.alertTitle}>Rebalanceamento</div>
                <div className={styles.alertSub}>{buyAssets.length} comprar · {sellAssets.length} reduzir</div>
              </div>
              <ArrowRight size={15} style={{ color: 'var(--color-text-3)' }}/>
            </button>
          )}

          {upcomingBoletos.length > 0 && (
            <button className={`${styles.alertChip} ${styles.alertBoleto}`} onClick={() => onNavigate('finances')}>
              <div className={`${styles.alertIcon} ${styles.alertIconBoleto}`}><CalendarClock size={17}/></div>
              <div className={styles.alertBody}>
                <div className={styles.alertTitle}>{upcomingBoletos.length} boleto{upcomingBoletos.length > 1 ? 's' : ''} vencendo</div>
                <div className={styles.alertSub}>Próximos 7 dias</div>
              </div>
              <span className={`${styles.alertVal} ${styles.alertValDanger}`}>{formatCurrency(upcomingTotal)}</span>
            </button>
          )}

          {pendingDarfs.length > 0 && (
            <button className={`${styles.alertChip} ${styles.alertDarf}`} onClick={() => onNavigate('taxes')}>
              <div className={`${styles.alertIcon} ${styles.alertIconDarf}`}><Landmark size={17}/></div>
              <div className={styles.alertBody}>
                <div className={styles.alertTitle}>{pendingDarfs.length} DARF{pendingDarfs.length > 1 ? 's' : ''} pendente{pendingDarfs.length > 1 ? 's' : ''}</div>
                <div className={styles.alertSub}>IR sobre vendas</div>
              </div>
              <span className={`${styles.alertVal} ${styles.alertValWarn}`}>{formatCurrency(pendingDarfTotal)}</span>
            </button>
          )}
        </div>
      )}

      {/* ── Grid Main: Alocação + Top Performers ── */}
      <div className={styles.gridMain}>
        {/* Alocação por Classe */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}><PieChart size={15}/> Alocação por Classe</span>
            <button className={styles.cardLink} onClick={() => onNavigate('strategy')}>
              Estratégia <ArrowRight size={12}/>
            </button>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.allocBar}>
              {classTotals.map(c => (
                <div key={c.name} className={styles.allocSeg}
                  style={{ width: `${c.value}%`, background: c.color }}
                  title={`${c.name} — ${c.value.toFixed(1)}%`}
                />
              ))}
            </div>
            <div className={styles.allocLegend}>
              {classTotals.map(c => (
                <div key={c.name} className={styles.legendChip}>
                  <div className={styles.legendDot} style={{ background: c.color }}/>
                  {c.name} {c.value.toFixed(1)}%
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1rem' }}>
              {categorySummaries.map(cs => (
                <div key={cs.category.id} className={styles.catRow}>
                  <div className={styles.catLeft}>
                    <div className={styles.catDot} style={{ background: catColorMap[cs.category.className] }}/>
                    <span className={styles.catName}>{cs.category.subclassName}</span>
                  </div>
                  <div className={styles.catRight}>
                    <span className={styles.catPct}>{(cs.currentPercent || 0).toFixed(1)}%</span>
                    <span className={styles.catTarget}>/ {cs.targetPercent}%</span>
                    <span className={`${styles.catBadge} ${cs.action === 'buy' ? styles.catBuy : cs.action === 'sell' ? styles.catSell : styles.catOk}`}>
                      {cs.action === 'buy' ? `+${formatCurrency(cs.rebalanceAmount)}` : cs.action === 'sell' ? formatCurrency(cs.rebalanceAmount) : '✓'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}><BarChart3 size={15}/> Top Ativos</span>
            <button className={styles.cardLink} onClick={() => onNavigate('assets')}>
              Ver todos <ArrowRight size={12}/>
            </button>
          </div>
          <div className={styles.cardBody}>
            {topPerformers.map(a => (
              <div key={a.id} className={styles.perfRow}>
                <div className={styles.perfAvatar} style={{ background: tickerColor(a.ticker) }}>
                  {a.ticker.slice(0, 3)}
                </div>
                <div className={styles.perfBody}>
                  <div className={styles.perfTicker}>{a.ticker}</div>
                  <div className={styles.perfInfo}>{a.category?.subclassName || a.info}</div>
                </div>
                <div className={styles.perfRight}>
                  <div className={styles.perfVal}>{formatCurrency(a.currentValue)}</div>
                  <div className={`${styles.perfPct} ${a.profitLossPercent >= 0 ? styles.perfGood : styles.perfBad}`}>
                    {a.profitLossPercent >= 0 ? '+' : ''}{a.profitLossPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Finanças do Mês + Survival ── */}
      <div className={styles.gridMain}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}><Wallet size={15}/> Finanças — {activeMonth ? fmtMonth(activeMonth.month) : 'Mês'}</span>
            <button className={styles.cardLink} onClick={() => onNavigate('finances')}>
              Abrir <ArrowRight size={12}/>
            </button>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.finRow}>
              <span className={styles.finLabel}><ArrowUpRight size={14} color="#34D399"/> Receitas</span>
              <span className={`${styles.finVal} ${styles.finGood}`}>{formatCurrency(monthSummary.income)}</span>
            </div>
            <div className={styles.finRow}>
              <span className={styles.finLabel}><ArrowDownRight size={14} color="#F87171"/> Boletos</span>
              <span className={`${styles.finVal} ${styles.finBad}`}>{formatCurrency(monthSummary.boletos)}</span>
            </div>
            <div className={styles.finRow}>
              <span className={styles.finLabel}>💳 Assinaturas</span>
              <span className={`${styles.finVal} ${styles.finBad}`}>{formatCurrency(monthSummary.subs)}</span>
            </div>
            <div className={styles.finRow}>
              <span className={styles.finLabel}>🛒 Extras</span>
              <span className={`${styles.finVal} ${styles.finBad}`}>{formatCurrency(monthSummary.extras)}</span>
            </div>
            <div className={styles.finRow} style={{ borderBottom: 'none', paddingTop: '0.65rem', borderTop: '1px solid var(--color-border)', marginTop: '0.35rem' }}>
              <span className={styles.finLabel} style={{ fontWeight: 700, color: 'var(--color-text)' }}>Saldo</span>
              <span className={`${styles.finVal} ${monthSummary.balance >= 0 ? styles.finGood : styles.finBad}`} style={{ fontSize: '1rem' }}>
                {formatCurrency(monthSummary.balance)}
              </span>
            </div>
            {monthSummary.income > 0 && (
              <div className={styles.finBar}>
                <div className={styles.finBarFill} style={{
                  width: `${Math.min((monthSummary.expense / monthSummary.income) * 100, 100)}%`,
                  background: monthSummary.expense / monthSummary.income > 0.9 ? '#EF4444' : monthSummary.expense / monthSummary.income > 0.7 ? '#FBBF24' : '#10B981',
                }}/>
              </div>
            )}
          </div>
        </div>

        {/* Tempo de Sobrevivência */}
        {monthlyCost > 0 && summary.totalValue > 0 && (
          <div className={styles.survivalCard}>
            <div className={styles.survivalIcon}><ShieldAlert size={28}/></div>
            <div className={styles.survivalBody}>
              <div className={styles.survivalTitle}>Tempo de Sobrevivência</div>
              <div className={styles.survivalDesc}>
                Com <strong>{formatCurrency(summary.totalValue)}</strong> de patrimônio e <strong>{formatCurrency(monthlyCost)}</strong>/mês de custos.
              </div>
            </div>
            <div className={styles.survivalNumbers}>
              <div className={styles.survivalMain}>{(summary.totalValue / monthlyCost).toFixed(0)} m</div>
              {summary.totalValue / monthlyCost >= 12 && (
                <div className={styles.survivalSub}>≈ {(summary.totalValue / monthlyCost / 12).toFixed(1)} anos</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Evolution Chart ── */}
      <EvolutionChart snapshots={snapshots.filter(s => s.strategyId === activeStrategy.id)} />

      {/* ── Allocation Donut (reaproveitando o componente existente) ── */}
      <AllocationChart summary={summary} />

      {/* ── Goal Widget ── */}
      <GoalWidget currentValue={summary.totalValue} strategyId={activeStrategy.id} />

      {/* ── AI Analysis ── */}
      <AiAnalysisCard summary={summary} strategyName={activeStrategy.name} />
    </div>
  );
}
