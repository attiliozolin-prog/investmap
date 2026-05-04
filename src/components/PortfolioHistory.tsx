'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { SellTaxRecord } from '@/types';
import styles from './PortfolioHistory.module.css';
import {
  X, TrendingUp, TrendingDown, ShoppingCart, DollarSign,
  CheckCircle, AlertTriangle, Clock, ExternalLink, Filter,
  ChevronDown, ChevronUp, Info, RefreshCw
} from 'lucide-react';

interface Props { onClose: () => void; }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
};
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

type TabId = 'extrato' | 'ir' | 'compensacao' | 'resumo';

export default function PortfolioHistory({ onClose }: Props) {
  const { transactions, assets, sellTaxRecords, updateSellTaxRecord } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('resumo');
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taxPaidDate, setTaxPaidDate] = useState<Record<string, string>>({});

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
  const sellsExempt    = sells.filter(r => !r.isLoss && r.isExempt);
  const sellsWithLoss  = sells.filter(r => r.isLoss);
  const sellsRfOrOther = sells.filter(r => !r.isLoss && !r.isExempt && r.taxDue === 0 && r.taxRate === 0);

  // ── Resumo ───────────────────────────────────────────────────────────────────
  const totalTaxDue   = sellsWithTax.reduce((s, r) => s + r.taxDue, 0);
  const totalTaxPaid  = sellsWithTax.filter(r => r.taxPaid).reduce((s, r) => s + r.taxDue, 0);
  const totalTaxPending = totalTaxDue - totalTaxPaid;
  const totalRealizedProfit = sells.filter(r => !r.isLoss).reduce((s, r) => s + r.profitLoss, 0);
  const totalRealizedLoss   = sells.filter(r => r.isLoss).reduce((s, r) => s + Math.abs(r.profitLoss), 0);
  const availableForComp    = sellsWithLoss.reduce((s, r) => s + (Math.abs(r.profitLoss) - r.lossUsedForCompensation), 0);

  const totalBought = transactions.filter(t => t.type === 'buy').reduce((s, t) => s + t.value, 0);
  const totalSold   = transactions.filter(t => t.type === 'sell').reduce((s, t) => s + t.value, 0);

  // ── Marcar IR como pago ─────────────────────────────────────────────────────
  const handleMarkPaid = (rec: SellTaxRecord) => {
    const paidAt = taxPaidDate[rec.id] || new Date().toISOString();
    updateSellTaxRecord(rec.id, {
      taxPaid: true,
      taxPaidAt: new Date(paidAt + 'T12:00:00').toISOString(),
    });
  };

  const handleMarkUnpaid = (rec: SellTaxRecord) => {
    updateSellTaxRecord(rec.id, { taxPaid: false, taxPaidAt: undefined });
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'resumo',       label: 'Resumo',           icon: <DollarSign size={15} /> },
    { id: 'extrato',      label: 'Extrato',           icon: <RefreshCw size={15} /> },
    { id: 'ir',           label: 'Imposto de Renda',  icon: <AlertTriangle size={15} /> },
    { id: 'compensacao',  label: 'Compensação',       icon: <TrendingDown size={15} /> },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────── */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Histórico Geral</h2>
            <p className={styles.subtitle}>Extrato completo · IR · Compensações</p>
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
                    <p>Total de {fmt(totalTaxPending)} em DARF não pago. Acesse a aba "Imposto de Renda" para detalhes e marcar como pago após quitação.</p>
                  </div>
                </div>
              )}
              {availableForComp > 0 && (
                <div className={styles.alertBox} style={{ borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.07)' }}>
                  <Info size={16} color="#FBBF24" />
                  <div>
                    <strong style={{ color: '#FBBF24' }}>Você tem prejuízos compensáveis!</strong>
                    <p>{fmt(availableForComp)} em prejuízos realizados podem ser usados para compensar IR em lucros futuros. Veja a aba "Compensação".</p>
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

          {/* ══════════════════════════════ IR ══════════════════════════════════ */}
          {activeTab === 'ir' && (
            <div className={styles.section}>
              {sells.length === 0
                ? <EmptyState text="Nenhuma venda registrada ainda. As vendas realizadas aparecerão aqui." />
                : (
                  <>
                    {sellsWithTax.length > 0 && (
                      <>
                        <h3 className={styles.sectionTitle}><AlertTriangle size={15} /> Vendas com IR Devido</h3>
                        <div className={styles.list}>
                          {sellsWithTax.map(rec => (
                            <TaxRecordCard key={rec.id} rec={rec} expanded={expandedId === rec.id}
                              onToggle={() => setExpandedId(prev => prev === rec.id ? null : rec.id)}
                              onMarkPaid={() => handleMarkPaid(rec)}
                              onMarkUnpaid={() => handleMarkUnpaid(rec)}
                              dateValue={taxPaidDate[rec.id] ?? ''}
                              onDateChange={v => setTaxPaidDate(p => ({ ...p, [rec.id]: v }))}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {sellsExempt.length > 0 && (
                      <>
                        <h3 className={styles.sectionTitle}><CheckCircle size={15} /> Vendas Isentas</h3>
                        <div className={styles.list}>
                          {sellsExempt.map(rec => (
                            <div key={rec.id} className={`${styles.taxCard} ${styles.taxCardExempt}`}>
                              <div className={styles.taxCardMain}>
                                <div>
                                  <span className={styles.taxCardTicker}>{rec.assetTicker}</span>
                                  <span className={styles.taxCardDate}>{fmtDate(rec.sellDate)}</span>
                                </div>
                                <div className={styles.taxCardRight}>
                                  <span className={styles.taxProfitGreen}>{fmt(rec.profitLoss)}</span>
                                  <span className={styles.taxExemptBadge}>Isento</span>
                                </div>
                              </div>
                              {rec.exemptReason && <p className={styles.taxExemptReason}>{rec.exemptReason}</p>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {sellsRfOrOther.length > 0 && (
                      <>
                        <h3 className={styles.sectionTitle}><Info size={15} /> Renda Fixa / Retido na Fonte</h3>
                        <div className={styles.list}>
                          {sellsRfOrOther.map(rec => (
                            <div key={rec.id} className={`${styles.taxCard}`}>
                              <div className={styles.taxCardMain}>
                                <div>
                                  <span className={styles.taxCardTicker}>{rec.assetTicker}</span>
                                  <span className={styles.taxCardDate}>{fmtDate(rec.sellDate)}</span>
                                </div>
                                <div className={styles.taxCardRight}>
                                  <span className={styles.taxProfitGreen}>{fmt(rec.profitLoss)}</span>
                                  <span className={styles.taxExemptBadge} style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}>Retido na Fonte</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {sellsWithLoss.length > 0 && (
                      <>
                        <h3 className={styles.sectionTitle}><TrendingDown size={15} /> Vendas com Prejuízo</h3>
                        <div className={styles.list}>
                          {sellsWithLoss.map(rec => (
                            <div key={rec.id} className={`${styles.taxCard} ${styles.taxCardLoss}`}>
                              <div className={styles.taxCardMain}>
                                <div>
                                  <span className={styles.taxCardTicker}>{rec.assetTicker}</span>
                                  <span className={styles.taxCardDate}>{fmtDate(rec.sellDate)}</span>
                                </div>
                                <div className={styles.taxCardRight}>
                                  <span className={styles.taxLossRed}>-{fmt(Math.abs(rec.profitLoss))}</span>
                                  <span className={styles.taxLossBadge}>Prejuízo</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )
              }
            </div>
          )}

          {/* ══════════════════════════════ COMPENSAÇÃO ═════════════════════════ */}
          {activeTab === 'compensacao' && (
            <div className={styles.section}>
              <div className={styles.alertBox} style={{ borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.07)', marginBottom: '1.25rem' }}>
                <Info size={16} color="#FBBF24" />
                <div>
                  <strong style={{ color: '#FBBF24' }}>Como funciona a compensação?</strong>
                  <p>Prejuízos realizados em vendas de ativos de <strong>renda variável</strong> podem ser usados para abater o lucro em vendas futuras <em>do mesmo tipo</em>, reduzindo o IR a pagar. A compensação é declarada mensalmente na ficha de Renda Variável do IRPF.</p>
                </div>
              </div>

              {sellsWithLoss.length === 0
                ? <EmptyState text="Nenhum prejuízo registrado. Quando você vender um ativo no negativo, o valor ficará disponível aqui para compensar IR futuro." />
                : (
                  <>
                    <h3 className={styles.sectionTitle}>Prejuízos disponíveis para compensação</h3>
                    <div className={styles.list}>
                      {sellsWithLoss.map(rec => {
                        const available = Math.abs(rec.profitLoss) - rec.lossUsedForCompensation;
                        return (
                          <div key={rec.id} className={`${styles.taxCard} ${styles.taxCardLoss}`}>
                            <div className={styles.taxCardMain}>
                              <div>
                                <span className={styles.taxCardTicker}>{rec.assetTicker}</span>
                                <span className={styles.taxCardDate}>{fmtDate(rec.sellDate)}</span>
                              </div>
                              <div className={styles.taxCardRight}>
                                <div style={{ textAlign: 'right' }}>
                                  <div className={styles.taxLossRed}>-{fmt(Math.abs(rec.profitLoss))}</div>
                                  <div style={{ fontSize: '0.72rem', color: available > 0 ? '#10B981' : 'var(--color-text-3)' }}>
                                    Disponível: {fmt(available)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {rec.lossUsedForCompensation > 0 && (
                              <p className={styles.taxExemptReason}>
                                ✅ {fmt(rec.lossUsedForCompensation)} já utilizados em compensações anteriores.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.compensationSummary}>
                      <span>Total disponível para compensar:</span>
                      <strong style={{ color: '#FBBF24' }}>{fmt(availableForComp)}</strong>
                    </div>

                    <div className={styles.alertBox} style={{ borderColor: 'rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.07)', marginTop: '1rem' }}>
                      <Info size={15} color="#60A5FA" />
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-2)' }}>
                        Para declarar a compensação, preencha a ficha <strong>"Renda Variável"</strong> do programa IRPF, informando o prejuízo acumulado no campo correspondente ao mês da venda com lucro que deseja compensar.
                      </p>
                    </div>
                  </>
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

interface TaxRecordCardProps {
  rec: SellTaxRecord;
  expanded: boolean;
  onToggle: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
  dateValue: string;
  onDateChange: (v: string) => void;
}

function TaxRecordCard({ rec, expanded, onToggle, onMarkPaid, onMarkUnpaid, dateValue, onDateChange }: TaxRecordCardProps) {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const darfUrl = `https://sicalc.receita.fazenda.gov.br/sicalc/rapido/contribuinte`;

  return (
    <div className={`${styles.taxCard} ${rec.taxPaid ? styles.taxCardPaid : styles.taxCardDue}`}>
      <div className={styles.taxCardMain} onClick={onToggle} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {rec.taxPaid
            ? <CheckCircle size={15} color="#10B981" />
            : <Clock size={15} color="#F59E0B" />
          }
          <div>
            <span className={styles.taxCardTicker}>{rec.assetTicker}</span>
            <span className={styles.taxCardDate}>{rec.sellDate.slice(0,7).replace('-','/')}</span>
          </div>
        </div>
        <div className={styles.taxCardRight}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-2)' }}>Lucro: {fmt(rec.profitLoss)}</div>
            <div style={{ fontWeight: 700, color: rec.taxPaid ? '#10B981' : '#F59E0B' }}>IR: {fmt(rec.taxDue)}</div>
          </div>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {expanded && (
        <div className={styles.taxCardDetails}>
          <div className={styles.taxDetailGrid}>
            <div><span className={styles.taxDetailLabel}>Valor vendido</span><span>{fmt(rec.sellValue)}</span></div>
            <div><span className={styles.taxDetailLabel}>Custo médio</span><span>{fmt(rec.costBasis)}</span></div>
            <div><span className={styles.taxDetailLabel}>Lucro</span><span style={{ color: '#10B981' }}>{fmt(rec.profitLoss)}</span></div>
            <div><span className={styles.taxDetailLabel}>Alíquota</span><span>{(rec.taxRate * 100).toFixed(1)}%</span></div>
            <div><span className={styles.taxDetailLabel}>IR devido</span><span style={{ color: '#F59E0B', fontWeight: 700 }}>{fmt(rec.taxDue)}</span></div>
            <div><span className={styles.taxDetailLabel}>Competência DARF</span><span>{rec.darfPeriod?.replace('-','/')}</span></div>
          </div>

          {!rec.taxPaid && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
              <a href={darfUrl} target="_blank" rel="noopener noreferrer" className={styles.darfBtn}>
                <ExternalLink size={13} /> Gerar DARF (Sicalc)
              </a>
              <input type="date" className={styles.dateInput} value={dateValue} onChange={e => onDateChange(e.target.value)} title="Data do pagamento" />
              <button className={styles.paidBtn} onClick={onMarkPaid}>✓ Marcar como pago</button>
            </div>
          )}

          {rec.taxPaid && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', color: '#10B981' }}>
                ✅ Pago em {rec.taxPaidAt ? new Date(rec.taxPaidAt).toLocaleDateString('pt-BR') : '—'}
              </span>
              <button className={styles.unpaidBtn} onClick={onMarkUnpaid}>Desfazer</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
