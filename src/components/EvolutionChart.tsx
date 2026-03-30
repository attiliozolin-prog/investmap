import React, { useState, useMemo, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { PortfolioSnapshot } from '@/types';
import styles from './EvolutionChart.module.css';

interface EvolutionChartProps {
  snapshots: PortfolioSnapshot[];
}

type Period = '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

// Formatação do Y Axis para R$ minificado
const formatYAxis = (tickItem: number) => {
  if (tickItem === 0) return '0';
  if (tickItem >= 1000000) return `R$ ${(tickItem / 1000000).toFixed(1)}M`;
  if (tickItem >= 1000) return `R$ ${(tickItem / 1000).toFixed(0)}k`;
  return `R$ ${tickItem}`;
};

// Formatação da Data (YYYY-MM-DD -> DD/MM)
const formatDateStr = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as PortfolioSnapshot;
    const profitLoss = data.totalValue - data.totalInvested;
    const isProfit = profitLoss >= 0;

    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid #eef2f6',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(10px)',
        minWidth: '220px'
      }}>
        <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {new Date(data.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#1e293b', fontSize: '0.9rem' }}>Patrimônio:</span>
            <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '1rem' }}>
              R$ {data.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Valor Aplicado:</span>
            <span style={{ color: '#64748b', fontWeight: 500 }}>
              R$ {data.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #f1f5f9'
           }}>
            <span style={{ color: '#1e293b', fontSize: '0.9rem', fontWeight: 600 }}>Rendimento:</span>
            <span style={{ fontWeight: 700, color: isProfit ? '#22c55e' : '#ef4444' }}>
              {isProfit ? '+' : ''}R$ {profitLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function EvolutionChart({ snapshots }: EvolutionChartProps) {
  const [period, setPeriod] = useState<Period>('ALL');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sortedData = useMemo(() => {
    return [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [snapshots]);

  const filteredData = useMemo(() => {
    if (!isMounted) return [];
    if (period === 'ALL') return sortedData;
    
    const cutoffDate = new Date();
    if (period === '7D') cutoffDate.setDate(cutoffDate.getDate() - 7);
    else if (period === '1M') cutoffDate.setMonth(cutoffDate.getMonth() - 1);
    else if (period === '3M') cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    else if (period === '6M') cutoffDate.setMonth(cutoffDate.getMonth() - 6);
    else if (period === '1Y') cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    
    return sortedData.filter(d => new Date(d.date) >= cutoffDate);
  }, [sortedData, period, isMounted]);

  const performance = useMemo(() => {
    if (filteredData.length < 2) return 0;
    const startValue = filteredData[0].totalValue;
    const endValue = filteredData[filteredData.length - 1].totalValue;
    if (startValue === 0) return 0;
    return ((endValue - startValue) / startValue) * 100;
  }, [filteredData]);

  if (!isMounted) return null;

  if (sortedData.length === 0 || sortedData.every(s => s.totalValue === 0)) {
    return (
      <div className={styles.container} style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h3 className={styles.title}>Evolução da Carteira</h3>
        <p className={styles.subtitle} style={{ textAlign: 'center', marginTop: '12px' }}>
          Seu crescimento será exibido aqui conforme você atualiza seu patrimônio.
        </p>
      </div>
    );
  }

  const isPositive = performance >= 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>Evolução da Carteira</h3>
            {filteredData.length > 1 && (
              <div className={`${styles.performanceBadge} ${isPositive ? styles.performancePositive : styles.performanceNegative}`}>
                {isPositive ? '↑' : '↓'} {Math.abs(performance).toFixed(2)}%
              </div>
            )}
          </div>
          <p className={styles.subtitle}>Crescimento do patrimônio ao longo do tempo</p>
        </div>

        <div className={styles.periodSelector}>
          {(['7D', '1M', '6M', '1Y', 'ALL'] as Period[]).map((p) => (
            <button
              key={p}
              className={`${styles.periodButton} ${period === p ? styles.periodButtonActive : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'ALL' ? 'Tudo' : p}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEvolution" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              tickFormatter={formatDateStr}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              tickFormatter={formatYAxis}
              width={75}
            />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' }}
            />
            
            <Area 
              type="monotone" 
              dataKey="totalInvested" 
              stroke="#cbd5e1" 
              strokeWidth={1.5}
              strokeDasharray="6 6"
              fill="transparent" 
              name="Investimento"
              activeDot={false}
            />

            <Area 
              type="monotone" 
              dataKey="totalValue" 
              stroke="#6366f1" 
              strokeWidth={4}
              fillOpacity={1} 
              fill="url(#colorEvolution)" 
              name="Patrimônio"
              activeDot={{ r: 8, strokeWidth: 0, fill: '#6366f1', filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.5))' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
