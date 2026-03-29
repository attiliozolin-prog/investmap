import React from 'react';
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
import styles from './AiAnalysisCard.module.css'; // Usamos o mesmo design base de cards

interface EvolutionChartProps {
  snapshots: PortfolioSnapshot[];
}

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as PortfolioSnapshot;
    
    // Calcula lucro/prejuízo exato do dia (snapshot)
    const profitLoss = data.totalValue - data.totalInvested;
    const isProfit = profitLoss >= 0;

    return (
      <div style={{
        background: 'rgba(11, 11, 20, 0.95)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(10px)',
        minWidth: '200px'
      }}>
        <p style={{ color: 'var(--color-text-2)', fontSize: '0.8rem', marginBottom: 'var(--space-2)' }}>
          {new Date(data.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text)', fontSize: '0.9rem' }}>Patrimônio:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
              R$ {data.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-2)', fontSize: '0.9rem' }}>Valor Aplicado:</span>
            <span style={{ color: 'var(--color-text-2)' }}>
              R$ {data.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid var(--color-border)'
           }}>
            <span style={{ color: 'var(--color-text)', fontSize: '0.9rem' }}>Rendimento:</span>
            <span style={{ fontWeight: 600, color: isProfit ? 'var(--color-success)' : 'var(--color-danger)' }}>
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
  // Ordena cronologicamente os snapshots da estratégia
  const sortedData = [...snapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Se não tem dado suficiente (ou está tudo zerado), mostra empty state
  if (sortedData.length === 0 || sortedData.every(s => s.totalValue === 0)) {
    return (
      <div className={styles.card} style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h3 className={styles.title} style={{ marginBottom: '8px' }}>Evolução do Patrimônio</h3>
        <p style={{ color: 'var(--color-text-2)', fontSize: '0.9rem', textAlign: 'center' }}>
          O gráfico começará a exibir a evolução da sua carteira a partir dos próximos registros automáticos (snapshots).
        </p>
      </div>
    );
  }

  // Verifica se o patrimônio está crescendo (última cota para renderizar SVG verde/vermelho)
  const firstData = sortedData[0];
  const lastData = sortedData[sortedData.length - 1];
  
  // Decisão visual: Cor do Patrimonio Atual.
  // Pode ser 'Positivo' desde a origem, ou apenas considerar o verde primário da marca
  const isHealthy = lastData.totalValue >= lastData.totalInvested;
  
  const strokeColor = isHealthy ? 'var(--color-primary-light)' : 'var(--color-danger)';
  const fillColor = isHealthy ? 'var(--color-primary)' : 'var(--color-danger)';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconWrapper} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div>
            <h3 className={styles.title}>Evolução da Carteira</h3>
            <p className={styles.subtitle}>Crescimento do patrimônio ao longo do tempo</p>
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height: 320, marginTop: 'var(--space-6)' }}>
        <ResponsiveContainer>
          <AreaChart
            data={sortedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={fillColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={fillColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--color-text-2)', fontSize: 12 }}
              tickFormatter={formatDateStr}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--color-text-2)', fontSize: 12 }}
              tickFormatter={formatYAxis}
              width={65}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            
            {/* Linha do Valor Aplicado (Base) */}
            <Area 
              type="monotone" 
              dataKey="totalInvested" 
              stroke="var(--color-text-2)" 
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="transparent" 
              name="Valor Aplicado"
            />

            {/* Linha do Patrimônio Atual */}
            <Area 
              type="monotone" 
              dataKey="totalValue" 
              stroke={strokeColor} 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorCurrent)" 
              name="Patrimônio"
              activeDot={{ r: 6, strokeWidth: 0, fill: strokeColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
