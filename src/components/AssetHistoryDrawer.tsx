'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { X, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, CalendarDays, Hash, Trash2, PlusCircle, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { TransactionWithCalcs } from '@/types';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import styles from './AssetHistoryDrawer.module.css';
import TransactionModal from './TransactionModal';

interface Props {
  assetId: string;
  onClose: () => void;
}

// ============================================
// Cálculos das transações enriquecidas
// ============================================
function enrichTransactions(
  rawTxs: Array<{ id: string; assetId: string; type: 'buy' | 'sell'; date: string; value: number; notes?: string }>
): TransactionWithCalcs[] {
  const sorted = [...rawTxs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningInvested = 0;

  return sorted.map((tx, idx) => {
    let realizedProfit: number | undefined;

    if (tx.type === 'buy') {
      runningInvested += tx.value;
    } else {
      // Calcula o lucro realizado: quanto do investido corresponde ao valor vendido
      const proportionSold = runningInvested > 0 ? tx.value / (runningInvested + tx.value) : 0;
      const costBasis = runningInvested * proportionSold;
      realizedProfit = tx.value - costBasis;
      runningInvested = Math.max(0, runningInvested - costBasis);
    }

    return {
      ...tx,
      runningInvested,
      realizedProfit,
      index: idx + 1,
    };
  });
}

// ============================================
// Tooltip customizado do gráfico
// ============================================
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { label: string } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: '0.78rem',
    }}>
      <div style={{ color: 'var(--color-text-3)', marginBottom: 2 }}>{d.payload.label}</div>
      <div style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
        {formatCurrency(d.value)}
      </div>
    </div>
  );
}

// ============================================
// Formatadores
// ============================================
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysFrom(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years}a ${remMonths}m` : `${years}a`;
}

// ============================================
// Componente principal
// ============================================
export default function AssetHistoryDrawer({ assetId, onClose }: Props) {
  const { assets, transactions, deleteTransaction } = useApp();
  const asset = assets.find(a => a.id === assetId);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  // Fechar no Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const rawTxs = useMemo(
    () => transactions.filter(t => t.assetId === assetId),
    [transactions, assetId]
  );

  const enriched = useMemo(() => enrichTransactions(rawTxs), [rawTxs]);

  // Transações em ordem decrescente para exibição
  const displayTxs = useMemo(
    () => [...enriched].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [enriched]
  );

  // ============================================
  // Métricas calculadas
  // ============================================
  const metrics = useMemo(() => {
    const buys = enriched.filter(t => t.type === 'buy');
    const sells = enriched.filter(t => t.type === 'sell');

    const totalBought = buys.reduce((s, t) => s + t.value, 0);
    const totalSold = sells.reduce((s, t) => s + t.value, 0);
    const totalRealizedProfit = sells.reduce((s, t) => s + (t.realizedProfit ?? 0), 0);
    const unrealizedProfit = asset ? asset.currentValue - asset.investedValue : 0;
    const totalReturn = totalBought > 0
      ? ((asset?.currentValue ?? 0) + totalSold - totalBought) / totalBought * 100
      : 0;
    const avgBuy = buys.length > 0 ? totalBought / buys.length : 0;
    const firstDate = enriched.length > 0 ? enriched[0].date : null;

    return {
      totalBought,
      totalSold,
      totalRealizedProfit,
      unrealizedProfit,
      totalReturn,
      avgBuy,
      buyCount: buys.length,
      sellCount: sells.length,
      firstDate,
    };
  }, [enriched, asset]);

  // ============================================
  // Dados do gráfico
  // ============================================
  const chartData = useMemo(() => {
    // Cronológico, inclui ponto "Hoje" com o currentValue
    const points = enriched.map(tx => ({
      label: formatDate(tx.date),
      value: tx.runningInvested,
    }));

    // Adiciona ponto de hoje com o currentValue real se diferente do último runningInvested
    if (asset && enriched.length > 0) {
      points.push({ label: 'Hoje', value: asset.currentValue });
    }
    return points;
  }, [enriched, asset]);

  const handleDelete = useCallback((id: string) => {
    deleteTransaction(id);
    setConfirmDeleteId(null);
  }, [deleteTransaction]);

  if (!asset) return null;

  return (
    <>
      {/* Overlay */}
      <div className={styles.overlay} onClick={onClose} />

      {/* Drawer */}
      <div className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Histórico de ${asset.ticker}`}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.ticker}>{asset.ticker}</span>
            <div className={styles.subInfo}>
              {asset.info && <span className={styles.subclassBadge}>{asset.info}</span>}
              {metrics.firstDate && (
                <span className={styles.timeBadge}>
                  <CalendarDays size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                  {daysFrom(metrics.firstDate)} na carteira
                </span>
              )}
            </div>
          </div>
          <button className={`btn btn-ghost btn-sm ${styles.closeBtn}`} onClick={onClose} aria-label="Fechar histórico">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>

          {/* ===== SEÇÃO 1: MÉTRICAS ===== */}
          <section>
            <p className={styles.sectionTitle}>Resumo</p>
            <div className={styles.metricsGrid}>

              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Total Aportado</span>
                <span className={styles.metricValue}>
                  {formatCurrency(metrics.totalBought)}
                </span>
              </div>

              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Total Resgatado</span>
                <span className={styles.metricValue}>
                  {formatCurrency(metrics.totalSold)}
                </span>
              </div>

              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>L/P Não Realizado</span>
                <span className={`${styles.metricValue} ${metrics.unrealizedProfit >= 0 ? styles.profit : styles.loss}`}>
                  {metrics.unrealizedProfit >= 0 ? '+' : ''}{formatCurrency(metrics.unrealizedProfit)}
                </span>
              </div>

              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>L/P Realizado (vendas)</span>
                <span className={`${styles.metricValue} ${metrics.totalRealizedProfit >= 0 ? styles.profit : styles.loss}`}>
                  {metrics.totalRealizedProfit >= 0 ? '+' : ''}{formatCurrency(metrics.totalRealizedProfit)}
                </span>
              </div>

              <div className={styles.metricCard + ' ' + styles.wide}>
                <span className={styles.metricLabel}>Retorno Total (aportado vs atual + resgatado)</span>
                <span className={`${styles.metricValue} ${metrics.totalReturn >= 0 ? styles.profit : styles.loss}`}>
                  {metrics.totalReturn >= 0 ? '+' : ''}{metrics.totalReturn.toFixed(2)}%
                </span>
              </div>

              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Ticket Médio / Aporte</span>
                <span className={`${styles.metricValue} ${styles.muted}`}>
                  {formatCurrency(metrics.avgBuy)}
                </span>
              </div>

              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Nº de Movimentações</span>
                <span className={`${styles.metricValue} ${styles.muted}`}>
                  <span style={{ color: 'var(--color-success)' }}>↑{metrics.buyCount}</span>
                  {' '}
                  <span style={{ color: 'var(--color-danger)' }}>↓{metrics.sellCount}</span>
                </span>
              </div>

              {metrics.firstDate && (
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>1º Aporte</span>
                  <span className={`${styles.metricValue} ${styles.muted}`}>
                    {formatDate(metrics.firstDate)}
                  </span>
                </div>
              )}

              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Valor Atual</span>
                <span className={styles.metricValue}>
                  {formatCurrency(asset.currentValue)}
                </span>
              </div>

            </div>
          </section>

          {/* ===== SEÇÃO 2: GRÁFICO ===== */}
          {chartData.length >= 2 && (
            <section>
              <p className={styles.sectionTitle}>Evolução do Saldo Investido</p>
              <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'var(--color-text-3)' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--color-text-3)' }}
                      axisLine={false}
                      tickLine={false}
                      width={55}
                      tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#8B5CF6"
                      strokeWidth={2.5}
                      dot={{ fill: '#8B5CF6', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#8B5CF6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* ===== SEÇÃO 3: LISTA DE TRANSAÇÕES ===== */}
          <section>
            <div className={styles.tableHeader}>
              <p className={styles.sectionTitle} style={{ margin: 0 }}>
                Transações ({rawTxs.length})
              </p>
              <button
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.78rem' }}
                onClick={() => setShowTransactionModal(true)}
              >
                <PlusCircle size={13} />
                Registrar
              </button>
            </div>

            {displayTxs.length === 0 ? (
              <div className={styles.emptyState}>
                <ChevronRight size={32} />
                <p>Nenhuma transação registrada ainda.</p>
              </div>
            ) : (
              <div className={styles.txList}>
                {displayTxs.map((tx) => (
                  <div key={tx.id}>
                    {confirmDeleteId === tx.id ? (
                      <div className={styles.deleteConfirm}>
                        <Trash2 size={13} />
                        Remover esta transação?
                        <button className={styles.deleteConfirmYes} onClick={() => handleDelete(tx.id)}>Sim</button>
                        <button className={styles.deleteConfirmNo} onClick={() => setConfirmDeleteId(null)}>Não</button>
                      </div>
                    ) : (
                      <div className={styles.txItem}>
                        {/* Ícone do tipo */}
                        <div className={`${styles.txTypeDot} ${styles[tx.type]}`}>
                          {tx.type === 'buy'
                            ? <ArrowUpCircle size={14} />
                            : <ArrowDownCircle size={14} />
                          }
                        </div>

                        {/* Conteúdo */}
                        <div className={styles.txContent}>
                          <div className={styles.txPrimary}>
                            <span className={`${styles.txValue} ${styles[tx.type]}`}>
                              {tx.type === 'buy' ? '+' : '-'}{formatCurrency(tx.value)}
                            </span>
                            <span className={`${styles.txBadge} ${styles[tx.type]}`}>
                              {tx.type === 'buy' ? 'Aporte' : 'Venda'}
                            </span>
                            {tx.type === 'sell' && tx.realizedProfit !== undefined && (
                              <span className={`${styles.txRealizedProfit} ${tx.realizedProfit >= 0 ? styles.profit : styles.loss}`}>
                                {tx.realizedProfit >= 0 ? '+' : ''}{formatCurrency(tx.realizedProfit)}
                              </span>
                            )}
                          </div>

                          <div className={styles.txSecondary}>
                            <span className={styles.txDate}>{formatDate(tx.date)}</span>
                            <span className={styles.txRunning}>
                              · investido: {formatCurrency(tx.runningInvested)}
                            </span>
                          </div>

                          {tx.notes && (
                            <div className={styles.txNotesFull}>"{tx.notes}"</div>
                          )}
                        </div>

                        {/* Ações */}
                        <div className={styles.txActions}>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Remover transação"
                            onClick={() => setConfirmDeleteId(tx.id)}
                            style={{ padding: '4px 6px', color: 'var(--color-text-3)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>
            Fechar
          </button>
        </div>

      </div>

      {/* Modal de nova transação disparado de dentro do drawer */}
      {showTransactionModal && (
        <TransactionModal
          assetId={assetId}
          onClose={() => setShowTransactionModal(false)}
        />
      )}
    </>
  );
}
