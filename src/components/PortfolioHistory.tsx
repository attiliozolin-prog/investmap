'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import styles from './PortfolioHistory.module.css';
import {
  X, TrendingUp, TrendingDown, ShoppingCart, DollarSign,
  CheckCircle, AlertTriangle, Clock, Filter, Info, RefreshCw,
} from 'lucide-react';

interface Props { onClose: () => void; }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
};
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

type TabId = 'extrato' | 'resumo';

export default function PortfolioHistory({ onClose }: Props) {
  const { transactions, assets, sellTaxRecords } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('resumo');
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>('all');

  // ── Extrato unificado ────────────────────────────────────────────────────────
  const extrato = useMemo(() => {
    return transactions
      .map(tx => {
        const asset = assets.find(a => a.id === tx.assetId);
        return { ...tx, ticker: asset?.ticker ?? '??', assetInfo: asset?.info ?? '' };
      })
      .filter(tx => filterType === 'all' || tx.type === filterType)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, assets, filterType]);

  // ── Registros de IR ──────────────────────────────────────────────────────────
  const sells = useMemo(() =>
    [...sellTaxRecords].sort((a, b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime()),
    [sellTaxRecords]
  );

  const sellsWithTax   = sells.filter(r => !r.isLoss && !r.isExempt && r.taxDue > 0);
  const sellsWithLoss  = sells.filter(r => r.isLoss);

  // ── Resumo ───────────────────────────────────────────────────────────────────
  const totalTaxDue   = sellsWithTax.reduce((s, r) => s + r.taxDue, 0);
  const totalTaxPaid  = sellsWithTax.filter(r => r.taxPaid).reduce((s, r) => s + r.taxDue, 0);
  const totalTaxPending = totalTaxDue - totalTaxPaid;
  const totalRealizedProfit = sells.filter(r => !r.isLoss).reduce((s, r) => s + r.profitLoss, 0);
  const totalRealizedLoss   = sells.filter(r => r.isLoss).reduce((s, r) => s + Math.abs(r.profitLoss), 0);
  // Apenas tipos compensáveis: bolsa comum (ações/ETFs/BDRs) e FII.
  // Cripto no regime nacional, renda fixa e LCI/LCA não permitem compensação.
  const availableForComp    = sellsWithLoss
    .filter(r => r.assetType === 'acao' || r.assetType === 'etf' || r.assetType === 'bdr' || r.assetType === 'fii')
    .reduce((s, r) => s + (Math.abs(r.profitLoss) - r.lossUsedForCompensation), 0);

  // Total Aportado: soma o investedValue de TODOS os ativos (ativos + encerrados)
  // + valor das vendas já realizadas (que saíram do investedValue)
  // Isso garante contabilidade completa independente de transações registradas.
  const totalInvestedAllAssets = assets.reduce((s, a) => s + a.investedValue, 0);
  const totalSellCostBasis = sells.reduce((s, r) => s + r.costBasis, 0);
  const totalBought = totalInvestedAllAssets + totalSellCostBasis;

  const totalSold   = transactions.filter(t => t.type === 'sell').reduce((s, t) => s + t.value, 0);


  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'resumo',  label: 'Resumo',  icon: <DollarSign size={15} /> },
    { id: 'extrato', label: 'Extrato', icon: <RefreshCw size={15} /> },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────── */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Histórico Geral</h2>
            <p className={styles.subtitle}>Extrato completo de compras e vendas</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        {/* ── Tabs ───────────────────────────────────── */}
        <div className={styles.tabs}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>

          {/* ══════════════════════════════ RESUMO ══════════════════════════════ */}
          {activeTab === 'resumo' && (
            <div className={styles.section}>
              <div className={styles.summaryGrid}>
                <SummaryCard label="Total Aportado"    value={fmt(totalBought)}           color="#60A5FA" icon={<ShoppingCart size={18} />} />
                <SummaryCard label="Total Vendido"     value={fmt(totalSold)}             color="#A78BFA" icon={<TrendingUp size={18} />} />
                <SummaryCard label="Lucro Realizado"   value={fmt(totalRealizedProfit)}   color="#10B981" icon={<TrendingUp size={18} />} />
                <SummaryCard label="Prejuízo Realizado" value={fmt(totalRealizedLoss)}    color="#EF4444" icon={<TrendingDown size={18} />} />
                <SummaryCard label="IR Total Devido"   value={fmt(totalTaxDue)}           color="#F59E0B" icon={<AlertTriangle size={18} />} />
                <SummaryCard label="IR Pago"           value={fmt(totalTaxPaid)}          color="#10B981" icon={<CheckCircle size={18} />} />
                <SummaryCard label="IR Pendente"       value={fmt(totalTaxPending)}       color={totalTaxPending > 0 ? '#EF4444' : '#10B981'} icon={<Clock size={18} />} />
                <SummaryCard label="Saldo p/ Compensar" value={fmt(availableForComp)}    color="#FBBF24" icon={<RefreshCw size={18} />} />
              </div>

              {totalTaxPending > 0 && (
                <div className={styles.alertBox} style={{ borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.07)' }}>
                  <AlertTriangle size={16} color="#EF4444" />
                  <div>
                    <strong style={{ color: '#EF4444' }}>Você tem IR pendente de pagamento!</strong>
                    <p>Total de {fmt(totalTaxPending)} em DARF não pago. Acesse a página Impostos (menu principal) para gerar o DARF e marcar como pago.</p>
                  </div>
                </div>
              )}
              {availableForComp > 0 && (
                <div className={styles.alertBox} style={{ borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.07)' }}>
                  <Info size={16} color="#FBBF24" />
                  <div>
                    <strong style={{ color: '#FBBF24' }}>Você tem prejuízos compensáveis!</strong>
                    <p>{fmt(availableForComp)} em prejuízos realizados podem ser usados para compensar IR em lucros futuros. Veja na página Impostos do menu principal.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════ EXTRATO ═════════════════════════════ */}
          {activeTab === 'extrato' && (
            <div className={styles.section}>
              <div className={styles.filterRow}>
                <span className={styles.filterLabel}><Filter size={13} /> Filtrar:</span>
                {(['all','buy','sell'] as const).map(f => (
                  <button key={f} className={`${styles.chip} ${filterType === f ? styles.chipActive : ''}`} onClick={() => setFilterType(f)}>
                    {f === 'all' ? 'Todos' : f === 'buy' ? '↑ Compras' : '↓ Vendas'}
                  </button>
                ))}
              </div>
              {extrato.length === 0
                ? <EmptyState text="Nenhuma movimentação encontrada." />
                : (
                  <div className={styles.list}>
                    {extrato.map(tx => (
                      <div key={tx.id} className={`${styles.txRow} ${tx.type === 'sell' ? styles.txSell : styles.txBuy}`}>
                        <div className={styles.txIcon}>
                          {tx.type === 'buy' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        </div>
                        <div className={styles.txInfo}>
                          <span className={styles.txTicker}>{tx.ticker}</span>
                          {tx.notes && <span className={styles.txNotes}>{tx.notes}</span>}
                        </div>
                        <div className={styles.txRight}>
                          <span className={`${styles.txValue} ${tx.type === 'sell' ? styles.txSellColor : styles.txBuyColor}`}>
                            {tx.type === 'sell' ? '-' : '+'}{fmt(tx.value)}
                          </span>
                          <span className={styles.txDate}>{fmtDate(tx.date)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className={styles.summaryCard} style={{ borderColor: `${color}30` }}>
      <div className={styles.summaryCardIcon} style={{ color }}>{icon}</div>
      <span className={styles.summaryCardLabel}>{label}</span>
      <span className={styles.summaryCardValue} style={{ color }}>{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ color: 'var(--color-text-2)', textAlign: 'center', padding: '2rem 0', fontSize: '0.9rem' }}>{text}</p>;
}

