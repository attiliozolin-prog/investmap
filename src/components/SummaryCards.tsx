'use client';

import { PortfolioSummary } from '@/types';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import styles from './SummaryCards.module.css';
import { TrendingUp, TrendingDown, Target, Zap } from 'lucide-react';

interface Props {
  summary: PortfolioSummary;
}

export default function SummaryCards({ summary }: Props) {
  const {
    totalInvested,
    totalValue,
    profitLoss,
    totalProfitLossPercent,
    healthScore,
    needsRebalancing,
  } = summary;

  const isProfit = profitLoss >= 0;

  return (
    <div className={styles.grid}>
      {/* Total Atual */}
      <div className={`card ${styles.card} ${styles.cardHighlight}`}>
        <div className={styles.cardLabel}>Patrimônio Atual</div>
        <div className={styles.cardValue}>{formatCurrency(totalValue)}</div>
        <div className={styles.cardSub}>
          Investido: {formatCurrency(totalInvested)}
        </div>
      </div>

      {/* Lucro/Prejuízo */}
      <div className={`card ${styles.card}`}>
        <div className={styles.cardTop}>
          <div className={styles.cardLabel}>Resultado</div>
          <div className={`${styles.cardIcon} ${isProfit ? styles.iconProfit : styles.iconLoss}`}>
            {isProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          </div>
        </div>
        <div className={`${styles.cardValue} ${isProfit ? styles.valueProfit : styles.valueLoss}`}>
          {formatCurrency(profitLoss)}
        </div>
        <div className={`${styles.cardBadge} ${isProfit ? styles.badgeProfit : styles.badgeLoss}`}>
          {formatPercent(totalProfitLossPercent)} sobre investido
        </div>
      </div>

      {/* Health Score */}
      <div className={`card ${styles.card}`}>
        <div className={styles.cardTop}>
          <div className={styles.cardLabel}>Saúde da Carteira</div>
          <div className={`${styles.cardIcon} ${styles.iconPrimary}`}>
            <Target size={16} />
          </div>
        </div>
        <div className={styles.cardValue}>{healthScore.toFixed(0)}%</div>
        <div className={styles.healthBar}>
          <div
            className={styles.healthFill}
            style={{
              width: `${healthScore}%`,
              background: healthScore >= 80
                ? 'var(--color-success)'
                : healthScore >= 60
                ? 'var(--color-warning)'
                : 'var(--color-danger)',
            }}
          />
        </div>
        <div className={styles.cardSub}>
          {healthScore >= 80 ? 'Carteira equilibrada ✓' : healthScore >= 60 ? 'Pequenos ajustes sugeridos' : 'Rebalanceamento recomendado'}
        </div>
      </div>

      {/* Rebalanceamento */}
      <div className={`card ${styles.card} ${needsRebalancing ? styles.cardAlert : ''}`}>
        <div className={styles.cardTop}>
          <div className={styles.cardLabel}>Rebalanceamento</div>
          <div className={`${styles.cardIcon} ${needsRebalancing ? styles.iconWarning : styles.iconSuccess}`}>
            <Zap size={16} />
          </div>
        </div>
        <div className={`${styles.cardValue} ${needsRebalancing ? styles.valueWarning : styles.valueSuccess}`}>
          {needsRebalancing ? 'Necessário' : 'Em dia'}
        </div>
        <div className={styles.cardSub}>
          {needsRebalancing
            ? 'Alguns ativos estão fora da meta'
            : 'Todos os ativos dentro da tolerância'}
        </div>
      </div>
    </div>
  );
}
