'use client';

import { PortfolioSummary, AssetWithCalcs, CategorySummary } from '@/types';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS, formatCurrency, formatPercentAbs } from '@/lib/calculations';
import styles from './AllocationChart.module.css';
import { useMemo } from 'react';

interface Props {
  summary: PortfolioSummary;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{d.name}</div>
      <div className={styles.tooltipRow}>
        <span>Atual</span>
        <span>{formatPercentAbs(d.currentPercent || (d.value / d.total * 100))}</span>
      </div>
      {d.targetPercent !== undefined && (
        <div className={styles.tooltipRow}>
          <span>Alvo</span>
          <span>{formatPercentAbs(d.targetPercent)}</span>
        </div>
      )}
      <div className={styles.tooltipRow}>
        <span>Valor</span>
        <span>{formatCurrency(d.currentValue || d.value)}</span>
      </div>
    </div>
  );
};

export default function AllocationChart({ summary }: Props) {
  const { categorySummaries, assetsWithCalcs, totalValue } = summary;

  // Agrupamento por Classe (Renda Fixa, Variável, Cripto)
  const classGroups = useMemo(() => {
    const groups: Record<string, { 
      name: string, 
      currentValue: number, 
      targetPercent: number, 
      categories: CategorySummary[],
      assets: AssetWithCalcs[] 
    }> = {};

    categorySummaries.forEach(cs => {
      const className = cs.category.className;
      if (!groups[className]) {
        groups[className] = { 
          name: className, 
          currentValue: 0, 
          targetPercent: 0, 
          categories: [],
          assets: [] 
        };
      }
      groups[className].currentValue += cs.currentValue;
      groups[className].targetPercent += cs.targetPercent;
      groups[className].categories.push(cs);
    });

    assetsWithCalcs.forEach(asset => {
      const className = asset.category.className;
      if (groups[className]) {
        groups[className].assets.push(asset);
      }
    });

    return Object.values(groups).sort((a, b) => b.currentValue - a.currentValue);
  }, [categorySummaries, assetsWithCalcs]);

  // Dados para o Gráfico Macro
  const macroData = classGroups.map((g, i) => ({
    name: g.name,
    value: Math.max(g.currentValue, 0.1),
    currentPercent: (g.currentValue / totalValue) * 100,
    targetPercent: g.targetPercent,
    currentValue: g.currentValue,
    color: CHART_COLORS[i % CHART_COLORS.length]
  }));

  const macroTargetData = classGroups.map((g, i) => ({
    name: g.name,
    value: Math.max(g.targetPercent, 0.1),
    color: CHART_COLORS[i % CHART_COLORS.length]
  }));

  return (
    <div className={styles.container}>
      {/* SEÇÃO MACRO */}
      <div className={`card ${styles.macroCard}`}>
        <div className={styles.header}>
          <h3>Alocação Estratégica</h3>
          <div className={styles.ringLegend}>
            <span className={styles.ringLabel}>Atual</span>
            <div className={styles.ringIndicator} style={{ background: 'var(--color-primary)' }} />
            <span className={styles.ringLabel} style={{ opacity: 0.5 }}>Alvo</span>
            <div className={styles.ringIndicator} style={{ background: 'var(--color-primary)', opacity: 0.3 }} />
          </div>
        </div>

        <div className={styles.macroContent}>
          <div className={styles.macroChartSide}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={macroData}
                  cx="50%" cy="50%"
                  outerRadius={90} innerRadius={65}
                  dataKey="value" strokeWidth={0}
                  isAnimationActive={false} // Desativa animação que às vezes trava no mobile
                >
                  {macroData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Pie
                  data={macroTargetData}
                  cx="50%" cy="50%"
                  outerRadius={60} innerRadius={45}
                  dataKey="value" strokeWidth={0}
                  opacity={0.3}
                  isAnimationActive={false}
                >
                  {macroTargetData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.macroLegendSide}>
            {macroData.map((d, i) => (
              <div key={d.name} className={styles.macroLegendItem}>
                <div className={styles.macroLegendHeader}>
                  <div className={styles.dot} style={{ background: d.color }} />
                  <span className={styles.macroName}>{d.name}</span>
                </div>
                <div className={styles.macroLegendValues}>
                  <span className={styles.val}>{d.currentPercent.toFixed(1)}%</span>
                  <span className={styles.target}>alvo {d.targetPercent}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SEÇÕES MICRO POR CLASSE */}
      <div className={styles.microGrid}>
        {classGroups.map((group, groupIdx) => {
          const assetData = group.assets.map((a, i) => ({
            name: a.ticker,
            value: a.currentValue,
            currentPercent: a.currentPortfolioPercent,
            currentValue: a.currentValue,
            color: CHART_COLORS[(groupIdx + i + 1) % CHART_COLORS.length]
          })).sort((a, b) => b.value - a.value);

          return (
            <div key={group.name} className={`card ${styles.microCard}`}>
              <div className={styles.microHeader}>
                <h4>{group.name}</h4>
                <span className={styles.microTotal}>{formatCurrency(group.currentValue)}</span>
              </div>

              <div className={styles.microChartSection}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={assetData}
                      cx="50%" cy="50%"
                      outerRadius={60} innerRadius={40}
                      dataKey="value" strokeWidth={0}
                    >
                      {assetData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className={styles.microBriefLegend}>
                  {assetData.slice(0, 4).map(a => (
                    <div key={a.name} className={styles.briefItem}>
                      <span className={styles.briefDot} style={{ background: a.color }} />
                      <span className={styles.briefName}>{a.name}</span>
                      <span className={styles.briefVal}>{a.currentPercent.toFixed(1)}%</span>
                    </div>
                  ))}
                  {assetData.length > 4 && <span className={styles.moreLabel}>+{assetData.length - 4} ativos</span>}
                </div>
              </div>

              {/* BARRAS DE REBALANCEAMENTO (SUBCLASSES) */}
              <div className={styles.microProgressList}>
                <div className={styles.progressHeader}>Subclasses & Alvos</div>
                {group.categories.map((cs, i) => {
                  const diff = cs.targetPercent - cs.currentPercent;
                  const absDiff = Math.abs(diff);
                  const color = CHART_COLORS[(groupIdx + i) % CHART_COLORS.length];

                  return (
                    <div key={cs.category.id} className={styles.progressBarRow}>
                      <div className={styles.barInfo}>
                        <span className={styles.barName}>{cs.category.subclassName}</span>
                        <span className={styles.barPercent}>{cs.currentPercent.toFixed(1)}%</span>
                      </div>
                      <div className={styles.barContainer}>
                        <div 
                          className={styles.barFill} 
                          style={{ width: `${Math.min(cs.currentPercent, 100)}%`, background: color }}
                        />
                        <div 
                          className={styles.barTargetMarker} 
                          style={{ left: `${cs.targetPercent}%` }}
                        />
                      </div>
                      <div className={`${styles.barDiff} ${diff > 0.5 ? styles.diffBuy : diff < -0.5 ? styles.diffSell : ''}`}>
                        {absDiff < 0.2 ? '✓' : diff > 0 ? `+${absDiff.toFixed(1)}%` : `-${absDiff.toFixed(1)}%`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
