'use client';

import { PortfolioSummary } from '@/types';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
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
    value: Math.max(cs.currentPercent, 0.01), // evita fatia zero que quebra animação
    currentPercent: cs.currentPercent,
    targetPercent: cs.targetPercent,
    currentValue: cs.currentValue,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const targetData = categorySummaries.map((cs, i) => ({
    name: cs.category.subclassName,
    value: Math.max(cs.targetPercent, 0.01),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className={`card ${styles.wrapper}`}>
      {/* Header */}
      <div className={styles.header}>
        <h3>Alocação da Carteira</h3>
        {/* Legenda dos anéis */}
        <div className={styles.ringLegend}>
          <span className={styles.ringItem}>
            <svg width="28" height="12">
              <rect x="0" y="0" width="12" height="12" rx="3" fill={CHART_COLORS[0]} opacity="0.9" />
              <rect x="16" y="0" width="12" height="12" rx="3" fill={CHART_COLORS[0]} opacity="0.28" />
            </svg>
          </span>
          <span className={styles.ringLabel}>Atual</span>
          <span className={styles.ringDivider}>|</span>
          <span className={styles.ringLabel} style={{ opacity: 0.5 }}>Alvo</span>
        </div>
      </div>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          {/* Anel externo: % atual */}
          <Pie
            data={currentData}
            cx="50%"
            cy="50%"
            outerRadius={110}
            innerRadius={72}
            dataKey="value"
            strokeWidth={0}
            isAnimationActive={true}
            animationBegin={0}
            animationDuration={700}
          >
            {currentData.map((entry, index) => (
              <Cell key={index} fill={entry.color} opacity={0.9} />
            ))}
          </Pie>
          {/* Anel interno: % alvo */}
          <Pie
            data={targetData}
            cx="50%"
            cy="50%"
            outerRadius={66}
            innerRadius={44}
            dataKey="value"
            strokeWidth={0}
            isAnimationActive={true}
            animationBegin={150}
            animationDuration={700}
          >
            {targetData.map((entry, index) => (
              <Cell key={index} fill={entry.color} opacity={0.28} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legenda de categorias — uma entrada por categoria, sem duplicação */}
      <div className={styles.categoryLegend}>
        {categorySummaries.map((cs, i) => (
          <div key={cs.category.id} className={styles.categoryLegendItem}>
            <span
              className={styles.categoryDot}
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className={styles.categoryLegendName}>{cs.category.subclassName}</span>
            <span className={styles.categoryLegendCurrent}>
              {(Number(cs.currentPercent) || 0).toFixed(1)}%
            </span>
            <span className={styles.categoryLegendTarget}>
              alvo {cs.targetPercent}%
            </span>
          </div>
        ))}
      </div>

      {/* Barras de progresso por subclasse */}
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
                    width: `${Math.min(cs.currentPercent, 100)}%`,
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
