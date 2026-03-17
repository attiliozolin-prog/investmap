'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useApp } from '@/context/AppContext';
import { calculatePortfolio } from '@/lib/calculations';
import SummaryCards from '@/components/SummaryCards';
import styles from './Dashboard.module.css';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';

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
  const { activeStrategy, activeAssets } = useApp();

  const summary = useMemo(() => {
    if (!activeStrategy || activeAssets.length === 0) return null;
    try {
      return calculatePortfolio(activeStrategy, activeAssets);
    } catch {
      return null;
    }
  }, [activeStrategy, activeAssets]);

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
      <div className="empty-state">
        <TrendingUp size={48} />
        <h3>Sua carteira está vazia</h3>
        <p>Adicione seus ativos para começar a acompanhar sua carteira.</p>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => onNavigate('assets')}>
          Adicionar ativos
        </button>
      </div>
    );
  }

  const { assetsWithCalcs, categorySummaries, needsRebalancing } = summary;
  const buyAssets  = assetsWithCalcs.filter((a) => a.action === 'buy');
  const sellAssets = assetsWithCalcs.filter((a) => a.action === 'sell');

  return (
    <div className={styles.wrapper}>
      {/* Rebalancing alert */}
      {needsRebalancing && (
        <div className={styles.alert}>
          <AlertTriangle size={16} />
          <span>
            <strong>Rebalanceamento necessário:</strong>{' '}
            {buyAssets.length > 0 && `Comprar: ${buyAssets.map((a) => a.ticker).join(', ')}`}
            {buyAssets.length > 0 && sellAssets.length > 0 && ' · '}
            {sellAssets.length > 0 && `Vender/Reduzir: ${sellAssets.map((a) => a.ticker).join(', ')}`}
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <SummaryCards summary={summary} />

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
                      <span>{cs.currentPercent.toFixed(1)}%</span>
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
            <span>{formatCurrency(summary.totalCurrent)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
