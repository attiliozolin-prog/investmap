'use client';

import { useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useApp } from '@/context/AppContext';
import { useFinance } from '@/context/FinanceContext';
import { calculatePortfolio } from '@/lib/calculations';
import SummaryCards from '@/components/SummaryCards';
import AiAnalysisCard from '@/components/AiAnalysisCard';
import EvolutionChart from '@/components/EvolutionChart';
import GoalWidget from '@/components/GoalWidget';
import styles from './Dashboard.module.css';
import { AlertTriangle, TrendingUp, CalendarClock } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import FirstUseTip from '@/components/FirstUseTip';

// Recharts usa window/ResizeObserver — deve renderizar SOMENTE no cliente
const AllocationChart = dynamic(() => import('@/components/AllocationChart'), {
  ssr: false,
  loading: () => (
    <div className="card" style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #252538', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  ),
});

export default function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { activeStrategy, activeAssets, saveSnapshot, snapshots, dbSynced, syncPrices, isSyncingPrices, lastPriceSyncAt } = useApp();
  const { transactions, months, activeMonthId } = useFinance();

  const summary = useMemo(() => {
    if (!activeStrategy || activeAssets.length === 0) return null;
    try {
      return calculatePortfolio(activeStrategy, activeAssets);
    } catch {
      return null;
    }
  }, [activeStrategy, activeAssets]);

  // Salva o snapshot diário automaticamente quando montamos a Dashboard (e temos dados da summary)
  useEffect(() => {
    if (summary && activeStrategy && summary.totalValue > 0) {
      const today = new Date().toISOString().split('T')[0];
      
      // Evita loop: verifica se já existe um snapshot para hoje com os mesmos valores
      const existing = snapshots.find(s => s.strategyId === activeStrategy.id && s.date === today);
      if (existing && 
          existing.totalValue === summary.totalValue && 
          existing.totalInvested === summary.totalInvested) {
        return;
      }

      saveSnapshot({
        date: today,
        strategyId: activeStrategy.id,
        totalInvested: isNaN(summary.totalInvested) ? 0 : summary.totalInvested,
        totalValue: isNaN(summary.totalValue) ? 0 : summary.totalValue,
        profitLoss: isNaN(summary.profitLoss) ? 0 : summary.profitLoss,
      });
    }
  }, [summary, activeStrategy, saveSnapshot, snapshots]);

  // ── Boletos próximos do vencimento (≤ 7 dias) ─────────────────────────────
  // Hook declarado ANTES dos early returns (regra de hooks do React)
  const upcomingBoletos = useMemo(() => {
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth(); // 0-indexed
    const todayYear = today.getFullYear();

    // Mês ativo do controle financeiro
    const activeMonth = months.find(m => m.id === activeMonthId);
    if (!activeMonth) return [];

    // Verifica se o mês ativo do controle financeiro é o mês atual
    const [mYear, mMonth] = activeMonth.month.split('-').map(Number);
    const isCurrentMonth = mYear === todayYear && (mMonth - 1) === todayMonth;

    // Se o mês ativo for futuro, mostra os que vencem nos próximos 7 dias a partir do dia 1
    // Se for o mês atual, mostra os que vencem entre hoje e hoje+7
    const monthTxs = transactions.filter(t => t.monthId === activeMonthId && t.section === 'boleto');
    const unpaid = monthTxs.filter(t =>
      (t.paymentStatus === 'pending' || t.paymentStatus === 'scheduled') &&
      t.dueDay != null
    );

    return unpaid.filter(t => {
      const dueDay = t.dueDay!;
      if (isCurrentMonth) {
        // dueDay está entre hoje e hoje+7 (inclusive)
        return dueDay >= todayDay && dueDay <= todayDay + 7;
      } else {
        // Para mês diferente do atual, mostra todos pendentes com dueDay nos próximos 7 dias do mês
        const dueDate = new Date(mYear, mMonth - 1, dueDay);
        const diffMs = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      }
    }).sort((a, b) => (a.dueDay ?? 0) - (b.dueDay ?? 0));
  }, [transactions, activeMonthId, months]);

  if (!activeStrategy) {
    return (
      <div className="empty-state">
        <TrendingUp size={48} />
        <h3>Nenhuma estratégia encontrada</h3>
        <p>Configure sua estratégia para começar.</p>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => onNavigate('strategy')}>
          Criar estratégia
        </button>
      </div>
    );
  }

  if (!summary || activeAssets.length === 0) {
    return (
      <div className="empty-state" style={{ maxWidth: 520, textAlign: 'left', padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <TrendingUp size={48} style={{ color: 'var(--color-primary-light)', marginBottom: 12 }} />
          <h3 style={{ margin: 0 }}>Vamos começar sua jornada</h3>
          <p style={{ color: 'var(--color-text-3)', marginTop: 6 }}>Configure em 3 passos simples:</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { step: 1, icon: '🎯', title: 'Defina sua estratégia', desc: 'Escolha como alocar seu patrimônio entre classes de ativos.', action: () => onNavigate('strategy'), label: 'Configurar estratégia', done: !!activeStrategy },
            { step: 2, icon: '📊', title: 'Adicione seus ativos', desc: 'Cadastre ações, FIIs, ETFs e renda fixa que você possui hoje.', action: () => onNavigate('assets'), label: 'Adicionar ativos', done: false },
            { step: 3, icon: '⚖️', title: 'Acompanhe e rebalanceie', desc: 'O InvestMap calcula automaticamente onde investir para manter sua estratégia.', action: undefined, label: undefined, done: false },
          ].map(item => (
            <div key={item.step} style={{
              display: 'flex', gap: '1rem', alignItems: 'flex-start',
              padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)', opacity: item.done ? 0.5 : 1
            }}>
              <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '0.9rem' }}>{item.step}. {item.title}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-3)', margin: '4px 0 0' }}>{item.desc}</p>
              </div>
              {item.action && !item.done && (
                <button className="btn btn-primary btn-sm" onClick={item.action} style={{ whiteSpace: 'nowrap', alignSelf: 'center' }}>
                  {item.label}
                </button>
              )}
              {item.done && <span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.8rem', alignSelf: 'center' }}>✓ Feito</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { assetsWithCalcs, categorySummaries, needsRebalancing } = summary;
  const buyAssets  = assetsWithCalcs.filter((a) => a.action === 'buy');
  const sellAssets = assetsWithCalcs.filter((a) => a.action === 'sell');

  // Tour de primeiro uso
  const showFirstUseTip = assetsWithCalcs.length > 0;

  const handleAssetAlertClick = (assetId: string) => {
    sessionStorage.setItem('highlight_asset_id', assetId);
    onNavigate('assets');
  };

  const handleBoletoAlertClick = (txId: string) => {
    sessionStorage.setItem('highlight_tx_id', txId);
    onNavigate('finances');
  };

  return (
    <div className={styles.wrapper}>
      {showFirstUseTip && <FirstUseTip />}
      {/* Rebalancing alert */}
      {needsRebalancing && (
        <div className={styles.alert}>
          <AlertTriangle size={16} className={styles.alertIcon} />
          <div className={styles.alertContent}>
            <strong>Rebalanceamento necessário</strong>
            <div className={styles.alertBadges}>
              {buyAssets.length > 0 && (
                <div className={styles.alertGroup}>
                  <span className={styles.alertGroupLabel}>↑ Comprar</span>
                  {buyAssets.map((a) => (
                    <button
                      key={a.id}
                      className={`${styles.alertTickerBuy} ${styles.alertTickerBtn}`}
                      onClick={() => handleAssetAlertClick(a.id)}
                      title={`Ver ${a.ticker} na aba Ativos`}
                    >
                      {a.ticker}
                    </button>
                  ))}
                </div>
              )}
              {sellAssets.length > 0 && (
                <div className={styles.alertGroup}>
                  <span className={styles.alertGroupLabel}>↓ Reduzir</span>
                  {sellAssets.map((a) => (
                    <button
                      key={a.id}
                      className={`${styles.alertTickerSell} ${styles.alertTickerBtn}`}
                      onClick={() => handleAssetAlertClick(a.id)}
                      title={`Ver ${a.ticker} na aba Ativos`}
                    >
                      {a.ticker}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Boletos próximos do vencimento */}
      {upcomingBoletos.length > 0 && (
        <div className={styles.alertDanger}>
          <CalendarClock size={16} className={styles.alertIcon} />
          <div className={styles.alertContent}>
            <strong>Boletos próximos do vencimento</strong>
            <div className={styles.alertBadges}>
              {upcomingBoletos.map((t) => (
                <button
                  key={t.id}
                  className={styles.alertBoletoItem}
                  onClick={() => handleBoletoAlertClick(t.id)}
                  title={`Ver ${t.description} no Controle Financeiro`}
                >
                  <span className={styles.alertBoletoDay}>Dia {t.dueDay}</span>
                  <span className={styles.alertBoletoDesc}>{t.description}</span>
                  <span className={styles.alertBoletoValue}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.value)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <SummaryCards summary={summary} isSyncingPrices={isSyncingPrices} lastPriceSyncAt={lastPriceSyncAt} />

      {/* Chart + Category Table */}
      <div className={styles.middleRow}>
        <AllocationChart summary={summary} />

        {/* Category Summary Table */}
        <div className={`card ${styles.catTable}`}>
          <h3 className={styles.catTitle}>Por Subclasse</h3>
          <div className={styles.catRows}>
            {categorySummaries.map((cs) => {
              const action = cs.action;
              return (
                <div key={cs.category.id} className={styles.catRow}>
                  <div>
                    <div className={styles.catName}>{cs.category.subclassName}</div>
                    <div className={styles.catClass}>{cs.category.className}</div>
                  </div>
                  <div className={styles.catRight}>
                    <div className={styles.catValue}>{formatCurrency(cs.currentValue)}</div>
                    <div className={styles.catPercents}>
                      <span>{(Number(cs.currentPercent) || 0).toFixed(1)}%</span>
                      <span className={styles.catTarget}>alvo {cs.targetPercent}%</span>
                    </div>
                    <div className={`${styles.catAction} ${
                      action === 'buy' ? styles.catBuy : action === 'sell' ? styles.catSell : styles.catOk
                    }`}>
                      {action === 'buy' ? `+${formatCurrency(cs.rebalanceAmount)}` :
                       action === 'sell' ? formatCurrency(cs.rebalanceAmount) : '✓'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className={styles.catFooter}>
            <span>Total da carteira</span>
            <span>{formatCurrency(summary.totalValue)}</span>
          </div>
        </div>
      </div>

      {/* Evolution Chart */}
      <EvolutionChart snapshots={snapshots.filter(s => s.strategyId === activeStrategy.id)} />

      {/* Goal Widget — Simulador de Metas */}
      <GoalWidget
        currentValue={summary.totalValue}
        strategyId={activeStrategy.id}
      />

      {/* AI Analysis Card */}
      <AiAnalysisCard summary={summary} strategyName={activeStrategy.name} />
    </div>
  );
}
