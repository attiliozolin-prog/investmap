'use client';

import { PortfolioSummary } from '@/types';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CHART_COLORS, formatCurrency, formatPercentAbs } from '@/lib/calculations';
import styles from './AllocationChart.module.css';

interface Props {
  summary: PortfolioSummary;
}

interface TooltipPayload {
  payload: {
    name: string;
    value: number;
    currentPercent: number;
    targetPercent: number;
    currentValue: number;
  };
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{d.name}</div>
      <div className={styles.tooltipRow}>
        <span>Atual</span>
        <span>{formatPercentAbs(d.currentPercent)}</span>
      </div>
      <div className={styles.tooltipRow}>
        <span>Alvo</span>
        <span>{formatPercentAbs(d.targetPercent)}</span>
      </div>
      <div className={styles.tooltipRow}>
        <span>Valor</span>
        <span>{formatCurrency(d.currentValue)}</span>
      </div>
    </div>
  );
};

export default function AllocationChart({ summary }: Props) {
  const { categorySummaries } = summary;

  const currentData = categorySummaries.map((cs, i) => ({
    name: cs.category.subclassName,
    value: cs.currentPercent,
    currentPercent: cs.currentPercent,
    targetPercent: cs.targetPercent,
    currentValue: cs.currentValue,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const targetData = categorySummaries.map((cs, i) => ({
    name: cs.category.subclassName,
    value: cs.targetPercent,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className={`card ${styles.wrapper}`}>
      <div className={styles.header}>
        <h3>Alocação da Carteira</h3>
        <div className={styles.legend}>
          <span className={styles.legendDot} style={{ background: 'var(--color-primary)' }} />
          Atual
          <span className={styles.legendDot} style={{ background: 'var(--color-surface-3)', marginLeft: 12 }} />
          Alvo
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          {/* Outer: current */}
          <Pie
            data={currentData}
            cx="50%"
            cy="50%"
            outerRadius={110}
            innerRadius={72}
            dataKey="value"
            strokeWidth={0}
            isAnimationActive={false}
          >
            {currentData.map((entry, index) => (
              <Cell key={index} fill={entry.color} opacity={0.9} />
            ))}
          </Pie>
          {/* Inner: target (muted) */}
          <Pie
            data={targetData}
            cx="50%"
            cy="50%"
            outerRadius={66}
            innerRadius={44}
            dataKey="value"
            strokeWidth={0}
            isAnimationActive={false}
          >
            {targetData.map((entry, index) => (
              <Cell key={index} fill={entry.color} opacity={0.3} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span style={{ color: 'var(--color-text-2)', fontSize: '0.8125rem' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Category rows */}
      <div className={styles.rows}>
        {categorySummaries.map((cs, i) => {
          const diff = cs.targetPercent - cs.currentPercent;
          const absDiff = Math.abs(diff);
          return (
            <div key={cs.category.id} className={styles.row}>
              <div className={styles.rowColorDot} style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <div className={styles.rowName}>{cs.category.subclassName}</div>
              <div className={styles.rowBar}>
                <div
                  className={styles.rowBarFill}
                  style={{
                    width: `${cs.currentPercent}%`,
                    background: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
                <div
                  className={styles.rowBarTarget}
                  style={{ left: `${cs.targetPercent}%` }}
                />
              </div>
              <div className={styles.rowPercent}>{formatPercentAbs(cs.currentPercent)}</div>
              <div className={`${styles.rowDiff} ${diff > 0.5 ? styles.rowDiffBuy : diff < -0.5 ? styles.rowDiffSell : styles.rowDiffOk}`}>
                {absDiff < 0.1 ? '✓' : diff > 0 ? `+${absDiff.toFixed(1)}%` : `-${absDiff.toFixed(1)}%`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
