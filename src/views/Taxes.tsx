'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { SellTaxRecord } from '@/types';
import TaxRecordCard from '@/components/tax/TaxRecordCard';
import phStyles from '@/components/PortfolioHistory.module.css';
import styles from './Taxes.module.css';
import {
  Landmark, AlertTriangle, CheckCircle, Clock, Info,
  TrendingDown, Download, RefreshCw,
} from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export default function Taxes() {
  const { sellTaxRecords, updateSellTaxRecord } = useApp();

  const [yearFilter, setYearFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taxPaidDate, setTaxPaidDate] = useState<Record<string, string>>({});

  // Anos disponíveis (com registros), mais recente primeiro
  const years = useMemo(() =>
    Array.from(new Set(sellTaxRecords.map(r => r.sellDate.slice(0, 4)))).sort().reverse(),
    [sellTaxRecords]
  );

  const sells = useMemo(() =>
    [...sellTaxRecords]
      .filter(r => yearFilter === 'all' || r.sellDate.startsWith(yearFilter))
      .sort((a, b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime()),
    [sellTaxRecords, yearFilter]
  );

  const sellsWithTax   = sells.filter(r => !r.isLoss && !r.isExempt && r.taxDue > 0);
  const sellsExempt    = sells.filter(r => !r.isLoss && r.isExempt);
  const sellsWithLoss  = sells.filter(r => r.isLoss);
  const sellsRfOrOther = sells.filter(r => !r.isLoss && !r.isExempt && r.taxDue === 0 && r.taxRate === 0);

  const totalTaxDue     = sellsWithTax.reduce((s, r) => s + r.taxDue, 0);
  const totalTaxPaid    = sellsWithTax.filter(r => r.taxPaid).reduce((s, r) => s + r.taxDue, 0);
  const totalTaxPending = totalTaxDue - totalTaxPaid;
  const totalExemptProfit = sellsExempt.reduce((s, r) => s + r.profitLoss, 0);
  // Compensação considera SEMPRE todos os anos (prejuízo acumula entre anos)
  const availableForComp = sellTaxRecords
    .filter(r => r.isLoss)
    .reduce((s, r) => s + (Math.abs(r.profitLoss) - r.lossUsedForCompensation), 0);

  const handleMarkPaid = (rec: SellTaxRecord) => {
    const paidAt = taxPaidDate[rec.id] || new Date().toISOString().slice(0, 10);
    updateSellTaxRecord(rec.id, {
      taxPaid: true,
      taxPaidAt: new Date(paidAt + 'T12:00:00').toISOString(),
    });
  };

  const handleMarkUnpaid = (rec: SellTaxRecord) => {
    updateSellTaxRecord(rec.id, { taxPaid: false, taxPaidAt: undefined });
  };

  // ── Relatório anual (CSV) — base para a declaração de IR ──────────────────
  const handleExportCsv = () => {
    const header = [
      'Data da venda', 'Ativo', 'Tipo tributário', 'Valor da venda', 'Custo médio',
      'Resultado', 'Situação', 'Motivo isenção', 'Alíquota (%)', 'IR devido',
      'IR pago', 'Pago em', 'Competência DARF',
    ];
    const csvVal = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const num = (v: number) => v.toFixed(2).replace('.', ',');

    const rows = sells.map(r => [
      fmtDate(r.sellDate),
      r.assetTicker,
      r.assetType,
      num(r.sellValue),
      num(r.costBasis),
      num(r.profitLoss),
      r.isLoss ? 'Prejuízo' : r.isExempt ? 'Isento' : r.taxDue > 0 ? 'Tributável' : 'Retido na fonte',
      r.exemptReason ?? '',
      (r.taxRate * 100).toFixed(1).replace('.', ','),
      num(r.taxDue),
      r.taxPaid ? 'Sim' : 'Não',
      r.taxPaidAt ? fmtDate(r.taxPaidAt) : '',
      r.darfPeriod ?? '',
    ].map(csvVal).join(';'));

    // ﻿ (BOM) faz o Excel abrir o arquivo com acentuação correta
    const csv = '﻿' + [header.map(csvVal).join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investmap-ir-${yearFilter === 'all' ? 'completo' : yearFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.title}><Landmark size={22}/> Impostos & IR</div>
        <div className={styles.headerRight}>
          <select className={styles.yearSelect} value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
            <option value="all">Todos os anos</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {sells.length > 0 && (
            <button className={styles.exportBtn} onClick={handleExportCsv} title="Exportar registros para conferência e declaração">
              <Download size={15}/> Relatório (CSV)
            </button>
          )}
        </div>
      </header>

      {sellTaxRecords.length === 0 ? (
        <div className={styles.emptyState}>
          <Landmark size={48}/>
          <h2>Nenhuma venda registrada ainda</h2>
          <p>
            Quando você registrar uma venda na aba Ativos, o InvestMap calcula automaticamente o IR devido,
            identifica isenções (R$ 20 mil/mês em ações, R$ 35 mil/mês em cripto) e acompanha seus DARFs aqui.
          </p>
        </div>
      ) : (
        <>
          {/* ── Resumo ── */}
          <div className={phStyles.summaryGrid}>
            <SummaryCard label="IR Pendente"        value={fmt(totalTaxPending)}   color={totalTaxPending > 0 ? '#EF4444' : '#10B981'} icon={<Clock size={18}/>}/>
            <SummaryCard label="IR Pago"            value={fmt(totalTaxPaid)}      color="#10B981" icon={<CheckCircle size={18}/>}/>
            <SummaryCard label="Lucro Isento"       value={fmt(totalExemptProfit)} color="#60A5FA" icon={<CheckCircle size={18}/>}/>
            <SummaryCard label="Saldo p/ Compensar" value={fmt(availableForComp)}  color="#FBBF24" icon={<RefreshCw size={18}/>}/>
          </div>

          {/* ── DARFs pendentes / vendas tributáveis ── */}
          {sellsWithTax.length > 0 && (
            <section>
              <h3 className={phStyles.sectionTitle}><AlertTriangle size={15}/> Vendas com IR Devido</h3>
              <div className={phStyles.list}>
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
            </section>
          )}

          {/* ── Isentas ── */}
          {sellsExempt.length > 0 && (
            <section>
              <h3 className={phStyles.sectionTitle}><CheckCircle size={15}/> Vendas Isentas</h3>
              <div className={phStyles.list}>
                {sellsExempt.map(rec => (
                  <div key={rec.id} className={`${phStyles.taxCard} ${phStyles.taxCardExempt}`}>
                    <div className={phStyles.taxCardMain}>
                      <div>
                        <span className={phStyles.taxCardTicker}>{rec.assetTicker}</span>
                        <span className={phStyles.taxCardDate}>{fmtDate(rec.sellDate)}</span>
                      </div>
                      <div className={phStyles.taxCardRight}>
                        <span className={phStyles.taxProfitGreen}>{fmt(rec.profitLoss)}</span>
                        <span className={phStyles.taxExemptBadge}>Isento</span>
                      </div>
                    </div>
                    {rec.exemptReason && <p className={phStyles.taxExemptReason}>{rec.exemptReason}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Renda fixa / retido na fonte ── */}
          {sellsRfOrOther.length > 0 && (
            <section>
              <h3 className={phStyles.sectionTitle}><Info size={15}/> Renda Fixa / Retido na Fonte</h3>
              <div className={phStyles.list}>
                {sellsRfOrOther.map(rec => (
                  <div key={rec.id} className={phStyles.taxCard}>
                    <div className={phStyles.taxCardMain}>
                      <div>
                        <span className={phStyles.taxCardTicker}>{rec.assetTicker}</span>
                        <span className={phStyles.taxCardDate}>{fmtDate(rec.sellDate)}</span>
                      </div>
                      <div className={phStyles.taxCardRight}>
                        <span className={phStyles.taxProfitGreen}>{fmt(rec.profitLoss)}</span>
                        <span className={phStyles.taxExemptBadge} style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}>Retido na Fonte</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Prejuízos e compensação ── */}
          {sellsWithLoss.length > 0 && (
            <section>
              <h3 className={phStyles.sectionTitle}><TrendingDown size={15}/> Prejuízos e Compensação</h3>
              <div className={phStyles.alertBox} style={{ borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.07)', marginBottom: '0.9rem' }}>
                <Info size={16} color="#FBBF24"/>
                <div>
                  <strong style={{ color: '#FBBF24' }}>Como funciona a compensação?</strong>
                  <p>Prejuízos em <strong>renda variável</strong> abatem o lucro de vendas futuras do mesmo tipo, reduzindo o IR. Declare mensalmente na ficha de Renda Variável do IRPF.</p>
                </div>
              </div>
              <div className={phStyles.list}>
                {sellsWithLoss.map(rec => {
                  const available = Math.abs(rec.profitLoss) - rec.lossUsedForCompensation;
                  return (
                    <div key={rec.id} className={`${phStyles.taxCard} ${phStyles.taxCardLoss}`}>
                      <div className={phStyles.taxCardMain}>
                        <div>
                          <span className={phStyles.taxCardTicker}>{rec.assetTicker}</span>
                          <span className={phStyles.taxCardDate}>{fmtDate(rec.sellDate)}</span>
                        </div>
                        <div className={phStyles.taxCardRight}>
                          <div style={{ textAlign: 'right' }}>
                            <div className={phStyles.taxLossRed}>-{fmt(Math.abs(rec.profitLoss))}</div>
                            <div style={{ fontSize: '0.72rem', color: available > 0 ? '#10B981' : 'var(--color-text-3)' }}>
                              Disponível: {fmt(available)}
                            </div>
                          </div>
                        </div>
                      </div>
                      {rec.lossUsedForCompensation > 0 && (
                        <p className={phStyles.taxExemptReason}>
                          ✅ {fmt(rec.lossUsedForCompensation)} já utilizados em compensações anteriores.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className={phStyles.compensationSummary}>
                <span>Total disponível para compensar:</span>
                <strong style={{ color: '#FBBF24' }}>{fmt(availableForComp)}</strong>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className={phStyles.summaryCard} style={{ borderColor: `${color}30` }}>
      <div className={phStyles.summaryCardIcon} style={{ color }}>{icon}</div>
      <span className={phStyles.summaryCardLabel}>{label}</span>
      <span className={phStyles.summaryCardValue} style={{ color }}>{value}</span>
    </div>
  );
}
