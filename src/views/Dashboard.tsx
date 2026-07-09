'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { calculatePortfolio, formatCurrency, CHART_COLORS } from '@/lib/calculations';
import GoalWidget from '@/components/GoalWidget';
import AiAnalysisCard from '@/components/AiAnalysisCard';
import FirstUseTip from '@/components/FirstUseTip';
import styles from './Dashboard.module.css';
import {
  TrendingUp, RefreshCw, AlertTriangle, CalendarClock,
  Landmark, ShieldAlert, ArrowRight, Wallet, Pencil,
  Target, Zap, CheckCircle2, X, Briefcase, Lightbulb,
} from 'lucide-react';

/**
 * Dashboard — centro de comando do app.
 *
 * Hierarquia (redesenhada a partir do protótipo em /prototipo/dashboard,
 * validado com o usuário):
 * 1. QUANTO EU TENHO — hero com patrimônio + gráfico de evolução integrado
 *    (hover com crosshair, períodos 3M/6M/1A/Tudo) e, ao lado, os 3 números
 *    de contexto: sobra do mês, sobrevivência e meta (abre o GoalWidget
 *    real num modal).
 * 2. O QUE PRECISA DE MIM — Central de Ações: inbox priorizada (DARF
 *    atrasado > pendente > boletos vencendo > rebalanceamento > fatura
 *    prevista a confirmar), com "tudo em dia" quando vazia.
 * 3. COMO ESTÃO OS PILARES — Carteira / Finanças / Impostos / Estratégia,
 *    cada um com 2-3 números reais e link direto.
 * 4. Insight da carteira + Análise por IA fecham a página.
 */

function tickerColor(t: string): string {
  const p = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#0891B2','#9333EA','#65A30D','#C2410C','#0D9488'];
  let h = 0;
  for (let i = 0; i < t.length; i++) h = t.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  return `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`;
};
const pctFmt = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

// ─── Gráfico de área com hover (linha 2px, wash, crosshair, ponto final) ────

const RANGES = [
  { id: '3m', label: '3M', days: 92 },
  { id: '6m', label: '6M', days: 183 },
  { id: '1a', label: '1A', days: 366 },
  { id: 'all', label: 'Tudo', days: Infinity },
] as const;
type RangeId = typeof RANGES[number]['id'];

interface SeriesPoint { label: string; value: number }

function AreaChart({ data }: { data: SeriesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 720, H = 190, PX = 6, PT = 14, PB = 20;
  const min = Math.min(...data.map(d => d.value));
  const max = Math.max(...data.map(d => d.value));
  const span = max - min || 1;
  const x = (i: number) => PX + (i / Math.max(1, data.length - 1)) * (W - PX * 2);
  const y = (v: number) => PT + (1 - (v - min) / span) * (H - PT - PB);

  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `${PX},${H - PB} ${line} ${W - PX},${H - PB}`;
  const lastI = data.length - 1;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - PX) / (W - PX * 2)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const h = hover != null ? data[hover] : null;
  const first = data[0].value;
  const deltaPct = first !== 0 ? ((data[lastI].value - first) / first) * 100 : 0;

  return (
    <div className={styles.chartWrap}>
      <svg
        ref={svgRef} className={styles.chartSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        role="img" aria-label={`Evolução do patrimônio: ${deltaPct >= 0 ? 'alta' : 'queda'} de ${pctFmt(Math.abs(deltaPct))} no período`}
      >
        <defs>
          <linearGradient id="dashAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#dashAreaFill)" />
        <polyline points={line} fill="none" stroke="#8B5CF6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(lastI)} cy={y(data[lastI].value)} r={4.5} fill="#8B5CF6" stroke="var(--color-surface)" strokeWidth={2} />
        {h && hover != null && (
          <>
            <line x1={x(hover)} y1={PT} x2={x(hover)} y2={H - PB} stroke="var(--color-border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(h.value)} r={4.5} fill="#8B5CF6" stroke="var(--color-surface)" strokeWidth={2} />
          </>
        )}
      </svg>
      {h && hover != null && (
        <div className={styles.chartTooltip} style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%` }}>
          {h.label}
          <strong>{formatCurrency(h.value)}</strong>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const {
    activeStrategy, activeAssets, saveSnapshot, snapshots, syncPrices,
    isSyncingPrices, lastPriceSyncAt, sellTaxRecords, activeGoal,
  } = useApp();
  const { user } = useAuth();
  const { transactions, months, activeMonthId, subscriptions } = useFinance();

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [range, setRange] = useState<RangeId>('1a');

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

  // Série de evolução (snapshots da estratégia ativa, ordenados por data)
  const fullSeries = useMemo(() => {
    if (!activeStrategy) return [] as (SeriesPoint & { date: string })[];
    return snapshots
      .filter(s => s.strategyId === activeStrategy.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => {
        const [y, mo, d] = s.date.split('-');
        return { date: s.date, label: `${d}/${mo}/${y.slice(2)}`, value: s.totalValue };
      });
  }, [snapshots, activeStrategy]);

  const chartData = useMemo(() => {
    const r = RANGES.find(x => x.id === range)!;
    if (!isFinite(r.days)) return fullSeries;
    const cutoff = new Date(Date.now() - r.days * 86400000).toISOString().slice(0, 10);
    const sliced = fullSeries.filter(p => p.date >= cutoff);
    return sliced.length >= 2 ? sliced : fullSeries;
  }, [fullSeries, range]);

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

  // Faturas "previstas" (valor estimado) do mês ativo, aguardando confirmação
  const previstoTxs = useMemo(() =>
    transactions.filter(t => t.monthId === activeMonthId && t.paymentStatus === 'previsto'),
  [transactions, activeMonthId]);
  const previstoTotal = previstoTxs.reduce((s, t) => s + t.value, 0);

  // DARFs — separa atrasado (competência já passou) de pendente dentro do prazo
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const pendingDarfs = useMemo(() =>
    sellTaxRecords.filter(r => !r.isLoss && !r.isExempt && r.taxDue > 0 && !r.taxPaid),
  [sellTaxRecords]);
  const overdueDarfs = pendingDarfs.filter(r => r.darfPeriod && r.darfPeriod < currentMonthStr);
  const dueDarfs = pendingDarfs.filter(r => !overdueDarfs.includes(r));
  const pendingDarfTotal = pendingDarfs.reduce((s, r) => s + r.taxDue, 0);

  // Impostos pagos no ano corrente (para o pilar de Impostos)
  const currentYear = new Date().getFullYear().toString();
  const paidThisYear = useMemo(() =>
    sellTaxRecords.filter(r => r.taxPaid && r.sellDate.startsWith(currentYear)).reduce((s, r) => s + r.taxDue, 0),
  [sellTaxRecords, currentYear]);

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
  const survivalMonths = monthlyCost > 0 && summary ? summary.totalValue / monthlyCost : 0;
  const burnPct = monthSummary.income > 0 ? Math.round((monthSummary.expense / monthSummary.income) * 100) : 0;

  // Greeting
  const hour = new Date().getHours();
  const greetText = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const firstName = (meta.full_name || meta.name || '').split(' ')[0];
  const todayLong = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Pre-compute derived values (hooks must vir antes dos early returns)
  const categorySummaries = summary?.categorySummaries ?? [];
  const assetsWithCalcs = summary?.assetsWithCalcs ?? [];
  const needsRebalancing = summary?.needsRebalancing ?? false;

  const catColorMap = useMemo(() => {
    const classNames = Array.from(new Set(categorySummaries.map(c => c.category.className))).sort();
    const map: Record<string, string> = {};
    classNames.forEach((cn, i) => { map[cn] = CHART_COLORS[i % CHART_COLORS.length]; });
    return map;
  }, [categorySummaries]);

  const classTotals = useMemo(() => {
    const map: Record<string, { value: number; color: string }> = {};
    Object.keys(catColorMap).forEach(cn => { map[cn] = { value: 0, color: catColorMap[cn] }; });
    categorySummaries.forEach(cs => {
      if (map[cs.category.className]) map[cs.category.className].value += cs.currentPercent;
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [categorySummaries, catColorMap]);

  const outOfTolerance = activeStrategy
    ? categorySummaries.filter(cs => Math.abs(cs.currentPercent - cs.targetPercent) > activeStrategy.deviationTolerance)
    : [];

  const goalProgressPct = activeGoal && activeGoal.targetValue > 0 && summary
    ? Math.min(100, (summary.totalValue / activeGoal.targetValue) * 100)
    : 0;

  // ETA da meta no ritmo atual (crescimento médio observado nos snapshots)
  const goalEtaYear = useMemo(() => {
    if (!activeGoal || !summary || fullSeries.length < 2) return null;
    const first = fullSeries[0];
    const last = fullSeries[fullSeries.length - 1];
    const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000;
    if (days < 14) return null;
    const perDay = (last.value - first.value) / days;
    if (perDay <= 0) return null;
    const remaining = activeGoal.targetValue - summary.totalValue;
    if (remaining <= 0) return null;
    const etaDays = remaining / perDay;
    if (etaDays > 365 * 60) return null;
    return new Date(Date.now() + etaDays * 86400000).getFullYear();
  }, [activeGoal, summary, fullSeries]);

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

  const buyAssets = assetsWithCalcs.filter(a => a.action === 'buy');
  const sellAssets = assetsWithCalcs.filter(a => a.action === 'sell');

  // Delta do período selecionado no gráfico
  const rangeFirst = chartData.length > 0 ? chartData[0].value : 0;
  const rangeDeltaPct = rangeFirst > 0 ? ((summary.totalValue - rangeFirst) / rangeFirst) * 100 : 0;

  // Melhor/pior performer do ano — único insight cross-domínio incluído
  // nesta primeira versão (sem duplicar cálculos de rebalanceamento que já
  // vivem na página de Ativos, para as duas páginas não divergirem).
  const ranked = [...assetsWithCalcs].filter(a => !a.isArchived && a.currentValue > 0).sort((a, b) => b.profitLossPercent - a.profitLossPercent);
  const bestPerformer = ranked[0];
  const worstPerformer = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  // ── Central de Ações: prioridade fixa (urgente → importante → oportunidade) ──
  interface ActionItem { key: string; icon: React.ReactNode; cls: string; title: React.ReactNode; sub: string; go: string; dest: string; }
  const actions: ActionItem[] = [];

  if (overdueDarfs.length > 0) {
    const total = overdueDarfs.reduce((s, r) => s + r.taxDue, 0);
    actions.push({
      key: 'darf-overdue', icon: <AlertTriangle size={16} />, cls: styles.aiUrgent,
      title: <>DARF{overdueDarfs.length > 1 ? 's' : ''} de <strong>{formatCurrency(total)}</strong> atrasado{overdueDarfs.length > 1 ? 's' : ''}</>,
      sub: 'Multa e juros correm desde o vencimento — gere o DARF e marque como pago',
      go: 'Resolver', dest: 'taxes',
    });
  }
  if (dueDarfs.length > 0) {
    const total = dueDarfs.reduce((s, r) => s + r.taxDue, 0);
    actions.push({
      key: 'darf-due', icon: <Landmark size={16} />, cls: styles.aiWarn,
      title: <>{dueDarfs.length} DARF{dueDarfs.length > 1 ? 's' : ''} pendente{dueDarfs.length > 1 ? 's' : ''} · <strong>{formatCurrency(total)}</strong></>,
      sub: 'IR sobre vendas do mês — vence no último dia útil do mês seguinte',
      go: 'Ver', dest: 'taxes',
    });
  }
  if (upcomingBoletos.length > 0) {
    actions.push({
      key: 'boletos', icon: <CalendarClock size={16} />, cls: styles.aiWarn,
      title: <>{upcomingBoletos.length} conta{upcomingBoletos.length > 1 ? 's' : ''} vence{upcomingBoletos.length > 1 ? 'm' : ''} em até 7 dias · <strong>{formatCurrency(upcomingTotal)}</strong></>,
      sub: upcomingBoletos.slice(0, 2).map(t => t.description).join(', ') + (upcomingBoletos.length > 2 ? '…' : ''),
      go: 'Ver contas', dest: 'finances',
    });
  }
  if (needsRebalancing) {
    actions.push({
      key: 'rebalance', icon: <Zap size={16} />, cls: styles.aiInfo,
      title: <><strong>{buyAssets.length}</strong> ativo{buyAssets.length !== 1 ? 's' : ''} para comprar · <strong>{sellAssets.length}</strong> para reduzir</>,
      sub: `${outOfTolerance.length} de ${categorySummaries.length} subclasses fora da tolerância de ${activeStrategy.deviationTolerance}pp`,
      go: 'Rebalancear', dest: 'assets',
    });
  }
  if (previstoTxs.length > 0) {
    actions.push({
      key: 'previsto', icon: <CalendarClock size={16} />, cls: styles.aiInfo,
      title: <>{previstoTxs.length} lançamento{previstoTxs.length > 1 ? 's' : ''} com valor <strong>≈ previsto</strong> · {formatCurrency(previstoTotal)}</>,
      sub: 'Valor estimado pela média — confirme quando a fatura fechar',
      go: 'Confirmar', dest: 'finances',
    });
  }

  return (
    <div className={styles.container}>
      {assetsWithCalcs.length > 0 && <FirstUseTip />}

      {/* ── Saudação ── */}
      <div className={styles.greeting}>
        <div className={styles.greetLeft}>
          <h1 className={styles.greetTitle}>{greetText}{firstName ? `, ${firstName}` : ''} 👋</h1>
          <span className={styles.greetSub}>
            {todayLong.charAt(0).toUpperCase() + todayLong.slice(1)} · aqui está o retrato do seu dinheiro
          </span>
        </div>
        <div className={styles.greetActions}>
          <button className={styles.syncChip} onClick={syncPrices} disabled={isSyncingPrices} title="Sincronizar cotações">
            <RefreshCw size={11} className={isSyncingPrices ? styles.syncSpin : ''}/>
            {isSyncingPrices
              ? 'Sincronizando…'
              : lastPriceSyncAt
                ? `Preços às ${lastPriceSyncAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Atualizar cotações'}
          </button>
        </div>
      </div>

      {/* ── Hero: patrimônio + evolução + stats laterais ── */}
      <section className={styles.heroGrid} aria-label="Resumo do patrimônio">
        <div className={styles.heroCard}>
          <div className={styles.heroTopRow}>
            <div>
              <span className={styles.heroLabel}>Patrimônio total</span>
              <div className={styles.heroValue}>{formatCurrency(summary.totalValue)}</div>
              <span className={styles.delta}>
                <span className={summary.profitLoss >= 0 ? styles.deltaGood : styles.deltaBad}>
                  {summary.profitLoss >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(summary.profitLoss))} ({pctFmt(Math.abs(summary.totalProfitLossPercent))})
                </span>
                <span className={styles.deltaRef}>desde o início</span>
                {chartData.length >= 2 && (
                  <>
                    <span className={rangeDeltaPct >= 0 ? styles.deltaGood : styles.deltaBad} style={{ marginLeft: 8 }}>
                      {rangeDeltaPct >= 0 ? '▲' : '▼'} {pctFmt(Math.abs(rangeDeltaPct))}
                    </span>
                    <span className={styles.deltaRef}>no período</span>
                  </>
                )}
              </span>
            </div>
            <div className={styles.rangeTabs} role="tablist" aria-label="Período do gráfico">
              {RANGES.map(r => (
                <button key={r.id} role="tab" aria-selected={range === r.id}
                  className={`${styles.rangeBtn} ${range === r.id ? styles.rangeActive : ''}`}
                  onClick={() => setRange(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {chartData.length >= 2 ? (
            <AreaChart data={chartData} />
          ) : (
            <div className={styles.chartEmpty}>
              O gráfico de evolução aparece aqui conforme o app registra snapshots diários do seu patrimônio.
            </div>
          )}
        </div>

        <div className={styles.sideCol}>
          <button className={styles.statCard} onClick={() => onNavigate('finances')} title="Ir para Finanças">
            <span className={styles.statLabel}><Wallet size={11}/> Sobra {activeMonth ? `de ${fmtMonth(activeMonth.month)}` : 'do mês'}</span>
            <span className={styles.statValue} style={{ color: monthSummary.balance >= 0 ? '#34D399' : '#F87171' }}>
              {formatCurrency(monthSummary.balance)}
            </span>
            {monthSummary.income > 0 ? (
              <>
                <span className={styles.statSub}>Você usou {burnPct}% das entradas</span>
                <div className={styles.miniMeter}><div className={styles.miniMeterFill} style={{ width: `${Math.min(100, burnPct)}%` }} /></div>
              </>
            ) : (
              <span className={styles.statSub}>Registre as receitas do mês em Finanças</span>
            )}
          </button>

          <button className={styles.statCard} onClick={() => onNavigate('finances')} title="Patrimônio ÷ custo mensal">
            <span className={styles.statLabel}><ShieldAlert size={11}/> Sobrevivência</span>
            <span className={styles.statValue}>{monthlyCost > 0 ? `${survivalMonths.toFixed(0)} meses` : '—'}</span>
            <span className={styles.statSub}>
              {monthlyCost > 0
                ? `≈ ${(survivalMonths / 12).toFixed(1).replace('.', ',')} anos no seu padrão de vida`
                : 'patrimônio ÷ custo mensal'}
            </span>
          </button>

          <button className={styles.statCard} onClick={() => setShowGoalModal(true)} title="Ver detalhes da meta">
            <span className={styles.statLabel}>
              <Target size={11}/> {activeGoal ? `Meta: ${formatCurrency(activeGoal.targetValue)}` : 'Meta financeira'}
              <Pencil size={10} className={styles.goalEditHint} />
            </span>
            {activeGoal ? (
              <>
                <span className={styles.statValue} style={{ color: '#A78BFA' }}>{pctFmt(goalProgressPct)}</span>
                <span className={styles.statSub}>
                  {goalEtaYear ? `ETA ~${goalEtaYear} no ritmo atual de aportes` : activeGoal.title}
                </span>
                <div className={styles.statMeter}><div className={styles.statMeterFill} style={{ width: `${goalProgressPct}%` }} /></div>
              </>
            ) : (
              <span className={styles.statSub}>Defina um objetivo e acompanhe o progresso automaticamente</span>
            )}
          </button>
        </div>
      </section>

      {/* ── Central de Ações ── */}
      <section className={styles.actionCard} aria-label="Ações pendentes">
        <div className={styles.actionHead}>
          <Zap size={15} color="#A78BFA" /> Precisa de você
          {actions.length > 0 && <span className={styles.actionCount}>{actions.length}</span>}
        </div>
        {actions.length === 0 ? (
          <div className={styles.actionEmpty}>
            <CheckCircle2 size={18} /> Tudo em dia — nenhuma ação pendente. Bom trabalho!
          </div>
        ) : (
          actions.map(a => (
            <button key={a.key} className={styles.actionRow} onClick={() => onNavigate(a.dest)}>
              <span className={`${styles.actionIcon} ${a.cls}`}>{a.icon}</span>
              <span className={styles.actionBody}>
                <div className={styles.actionTitle}>{a.title}</div>
                <div className={styles.actionSub}>{a.sub}</div>
              </span>
              <span className={styles.actionGo}><span>{a.go}</span> <ArrowRight size={13} /></span>
            </button>
          ))
        )}
      </section>

      {/* ── Pilares ── */}
      <section className={styles.pillars} aria-label="Áreas do app">
        <button className={styles.pillar} onClick={() => onNavigate('assets')}>
          <div className={styles.pillarHead}>
            <span className={styles.pillarTitle}><Briefcase size={13}/> Carteira</span>
            <ArrowRight size={14} className={styles.pillarArrow} />
          </div>
          <span className={styles.pillarValue}>{formatCurrency(summary.totalValue)}</span>
          {classTotals.length > 0 && (
            <div className={styles.miniAlloc}>
              {classTotals.map(c => (
                <span key={c.name} className={styles.miniAllocSeg} style={{ width: `${c.value}%`, background: c.color }} title={`${c.name}: ${c.value.toFixed(1)}%`} />
              ))}
            </div>
          )}
          <span className={styles.pillarSub}>{activeAssets.length} ativos em {classTotals.length} classes · saúde <strong>{Math.round(summary.healthScore)}/100</strong></span>
          <span className={`${styles.pillBadge} ${needsRebalancing ? styles.pbWarn : styles.pbGood}`}>
            {needsRebalancing ? `▲ ${buyAssets.length} comprar · ▼ ${sellAssets.length} reduzir` : '✓ carteira equilibrada'}
          </span>
        </button>

        <button className={styles.pillar} onClick={() => onNavigate('finances')}>
          <div className={styles.pillarHead}>
            <span className={styles.pillarTitle}><Wallet size={13}/> Finanças{activeMonth ? ` · ${fmtMonth(activeMonth.month)}` : ''}</span>
            <ArrowRight size={14} className={styles.pillarArrow} />
          </div>
          <span className={styles.pillarValue} style={{ color: monthSummary.balance >= 0 ? '#34D399' : '#F87171' }}>
            {monthSummary.balance >= 0 ? '+' : ''}{formatCurrency(monthSummary.balance)}
          </span>
          <span className={styles.pillarSub}>Entradas <strong>{formatCurrency(monthSummary.income)}</strong> · Saídas <strong>{formatCurrency(monthSummary.expense)}</strong></span>
          {upcomingBoletos.length > 0 ? (
            <span className={`${styles.pillBadge} ${styles.pbWarn}`}>{upcomingBoletos.length} conta{upcomingBoletos.length > 1 ? 's' : ''} a pagar · {formatCurrency(upcomingTotal)}</span>
          ) : (
            <span className={`${styles.pillBadge} ${styles.pbGood}`}>✓ sem contas vencendo</span>
          )}
        </button>

        <button className={styles.pillar} onClick={() => onNavigate('taxes')}>
          <div className={styles.pillarHead}>
            <span className={styles.pillarTitle}><Landmark size={13}/> Impostos</span>
            <ArrowRight size={14} className={styles.pillarArrow} />
          </div>
          <span className={styles.pillarValue} style={{ color: pendingDarfTotal > 0 ? '#F87171' : 'var(--color-text)' }}>
            {formatCurrency(pendingDarfTotal)}
          </span>
          <span className={styles.pillarSub}>DARF pendente · <strong>{formatCurrency(paidThisYear)}</strong> pagos em {currentYear}</span>
          {overdueDarfs.length > 0 ? (
            <span className={`${styles.pillBadge} ${styles.pbBad}`}>{overdueDarfs.length} atrasado{overdueDarfs.length > 1 ? 's' : ''} — resolver hoje</span>
          ) : pendingDarfs.length > 0 ? (
            <span className={`${styles.pillBadge} ${styles.pbWarn}`}>{pendingDarfs.length} pendente{pendingDarfs.length > 1 ? 's' : ''}</span>
          ) : (
            <span className={`${styles.pillBadge} ${styles.pbGood}`}>✓ em dia</span>
          )}
        </button>

        <button className={styles.pillar} onClick={() => onNavigate('strategy')}>
          <div className={styles.pillarHead}>
            <span className={styles.pillarTitle}><Target size={13}/> Estratégia</span>
            <ArrowRight size={14} className={styles.pillarArrow} />
          </div>
          <span className={styles.pillarValue}>{Math.round(summary.healthScore)}<span style={{ fontSize: '0.8rem', color: 'var(--color-text-3)' }}> /100</span></span>
          <span className={styles.pillarSub}>{outOfTolerance.length} de {categorySummaries.length} subclasses fora da tolerância de {activeStrategy.deviationTolerance}pp</span>
          <span className={`${styles.pillBadge} ${outOfTolerance.length === 0 ? styles.pbGood : styles.pbWarn}`}>
            {outOfTolerance.length === 0 ? '✓ tudo na meta' : `✓ plano definido · ${categorySummaries.length} metas`}
          </span>
        </button>
      </section>

      {/* ── Insight cross-domínio (melhor/pior ativo) ── */}
      {bestPerformer && worstPerformer && (
        <section className={styles.insightsCard} aria-label="Insights automáticos">
          <div className={styles.insightsHead}><Lightbulb size={15} /> Destaques da carteira</div>
          <div className={styles.insightRow}>
            <div className={styles.perfAvatar} style={{ background: tickerColor(bestPerformer.ticker) }}>{bestPerformer.ticker.slice(0, 3)}</div>
            <span>
              <strong>{bestPerformer.ticker}</strong> é seu melhor ativo (<strong style={{ color: '#34D399' }}>{bestPerformer.profitLossPercent >= 0 ? '+' : ''}{bestPerformer.profitLossPercent.toFixed(1)}%</strong>);{' '}
              <strong>{worstPerformer.ticker}</strong> é o pior (<strong style={{ color: '#F87171' }}>{worstPerformer.profitLossPercent >= 0 ? '+' : ''}{worstPerformer.profitLossPercent.toFixed(1)}%</strong>) e representa{' '}
              {((worstPerformer.currentValue / summary.totalValue) * 100).toFixed(1)}% da carteira.
            </span>
          </div>
        </section>
      )}

      {/* ── Análise por IA ── */}
      <AiAnalysisCard summary={summary} strategyName={activeStrategy.name} />

      {/* ── Modal: detalhe da meta (reaproveita o GoalWidget real) ── */}
      {showGoalModal && (
        <div className={styles.goalModalOverlay} onClick={() => setShowGoalModal(false)}>
          <div className={styles.goalModalWrap} onClick={e => e.stopPropagation()}>
            <button className={styles.goalModalClose} onClick={() => setShowGoalModal(false)} aria-label="Fechar"><X size={16}/></button>
            <GoalWidget currentValue={summary.totalValue} strategyId={activeStrategy.id} />
          </div>
        </div>
      )}
    </div>
  );
}
