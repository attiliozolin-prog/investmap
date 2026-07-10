'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { SellTaxRecord } from '@/types';
import {
  FileDown, Calendar, CheckCircle, Clock, Info, Shield, TrendingDown,
  ChevronDown, ExternalLink, RotateCcw, AlertTriangle, ScrollText,
} from 'lucide-react';
import styles from './Taxes.module.css';
import summaryStyles from '@/components/SummaryCards.module.css';
import TaxMethodologyModal from '@/components/TaxMethodologyModal';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

// Gera cor de avatar baseada no ticker
function tickerColor(ticker: string): string {
  const palette = [
    '#7C3AED','#2563EB','#059669','#D97706','#DC2626',
    '#7C3AED','#0891B2','#9333EA','#65A30D','#C2410C',
  ];
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export default function Taxes() {
  const { sellTaxRecords, updateSellTaxRecord } = useApp();

  const years = useMemo(() => {
    const ySet = new Set<string>();
    sellTaxRecords.forEach(r => ySet.add(r.sellDate.substring(0, 4)));
    const arr = Array.from(ySet).sort((a, b) => b.localeCompare(a));
    return arr.length > 0 ? arr : [new Date().getFullYear().toString()];
  }, [sellTaxRecords]);

  const [selectedYear, setSelectedYear] = useState(years[0]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payDate, setPayDate] = useState<Record<string, string>>({});
  const [showMethodology, setShowMethodology] = useState(false);

  const records = useMemo(() => sellTaxRecords.filter(r => r.sellDate.startsWith(selectedYear)), [sellTaxRecords, selectedYear]);
  const sorted = useMemo(() => [...records].sort((a, b) => b.sellDate.localeCompare(a.sellDate)), [records]);

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7);

  const sellsDue = sorted.filter(r => r.taxDue > 0);
  const sellsExempt = sorted.filter(r => r.taxDue === 0 && r.profitLoss > 0 && r.isExempt);
  const sellsRfOrOther = sorted.filter(r => r.taxDue === 0 && r.profitLoss > 0 && !r.isExempt && (r.assetType === 'renda_fixa' || r.assetType === 'lci_lca'));
  const sellsWithLoss = sorted.filter(r => r.profitLoss < 0);

  const pendingSells = sellsDue.filter(r => !r.taxPaid);
  const overdueSells = pendingSells.filter(r => r.darfPeriod && r.darfPeriod < currentMonth);
  const totalPending = pendingSells.reduce((s, r) => s + r.taxDue, 0);
  const totalPaid = sellsDue.filter(r => r.taxPaid).reduce((s, r) => s + r.taxDue, 0);
  const totalExemptProfit = sellsExempt.reduce((s, r) => s + r.profitLoss, 0);
  const totalLoss = sellsWithLoss.reduce((s, r) => s + r.profitLoss, 0);

  const isCompensable = (r: SellTaxRecord) => {
    if (r.assetType === 'crypto' || r.assetType === 'renda_fixa' || r.assetType === 'lci_lca') return false;
    return true;
  };
  const remaining = (r: SellTaxRecord) => Math.abs(r.profitLoss) - (r.lossUsedForCompensation || 0);
  const availableForComp = sellsWithLoss.filter(isCompensable).reduce((s, r) => s + remaining(r), 0);
  const compBolsa = sellsWithLoss.filter(r => isCompensable(r) && r.assetType !== 'fii').reduce((s, r) => s + remaining(r), 0);
  const compFii = sellsWithLoss.filter(r => r.assetType === 'fii').reduce((s, r) => s + remaining(r), 0);

  const handleExport = () => {
    const header = [
      'Data da venda', 'Ativo', 'Tipo tributário', 'Valor da venda', 'Custo médio',
      'Resultado', 'Situação', 'Motivo isenção', 'Alíquota (%)', 'IR devido',
      'IR pago', 'Pago em', 'Competência DARF',
    ];
    const csvVal = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const num = (v: number) => v.toFixed(2).replace('.', ',');
    const rows = sorted.map(r => [
      fmtDate(r.sellDate), r.assetTicker, r.assetType, num(r.sellValue), num(r.costBasis),
      num(r.profitLoss),
      r.profitLoss < 0 ? 'Prejuízo' : r.isExempt ? 'Isento' : r.taxDue > 0 ? 'Tributável' : 'Retido na fonte',
      r.exemptReason ?? '', (r.taxRate * 100).toFixed(1).replace('.', ','), num(r.taxDue),
      r.taxPaid ? 'Sim' : 'Não', r.taxPaidAt ? fmtDate(r.taxPaidAt) : '', r.darfPeriod ?? '',
    ].map(csvVal).join(';'));
    const csv = '\uFEFF' + [header.map(csvVal).join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `investmap-ir-${selectedYear}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleMarkPaid = (id: string) => {
    const dateToUse = payDate[id] || today;
    updateSellTaxRecord(id, { taxPaid: true, taxPaidAt: dateToUse });
  };
  const handleMarkUnpaid = (id: string) => {
    updateSellTaxRecord(id, { taxPaid: false, taxPaidAt: undefined });
  };

  // ── Render DARF Row ──
  const renderDarf = (rec: SellTaxRecord) => {
    const isExpanded = expandedId === rec.id;
    const isOverdue = !rec.taxPaid && rec.darfPeriod && rec.darfPeriod < currentMonth;
    const cardClass = rec.taxPaid
      ? styles.taxCardPaid
      : isOverdue ? styles.taxCardOverdue : styles.taxCardDue;
    const iconClass = rec.taxPaid ? styles.iconPaid : isOverdue ? styles.iconOverdue : styles.iconDue;
    const valClass  = rec.taxPaid ? styles.valPaid  : isOverdue ? styles.valOverdue  : styles.valDue;

    return (
      <div key={rec.id} className={`${styles.taxCard} ${cardClass}`}>
        <div className={styles.taxMain} onClick={() => setExpandedId(isExpanded ? null : rec.id)}>
          <div className={styles.taxInfo}>
            <div className={`${styles.taxIcon} ${iconClass}`}>
              {rec.taxPaid ? <CheckCircle size={18}/> : isOverdue ? <AlertTriangle size={18}/> : <Clock size={18}/>}
            </div>
            <div className={styles.taxBody}>
              <div className={styles.taxTitle}>{rec.assetTicker}</div>
              <div className={styles.taxMeta}>
                <span className={styles.taxDate}>{fmtDate(rec.sellDate)}</span>
                {rec.darfPeriod && (
                  <span className={styles.taxDate}>· Competência {rec.darfPeriod.replace('-','/')}</span>
                )}
                <span className={`${styles.taxBadge} ${rec.taxPaid ? styles.badgePaid : isOverdue ? styles.badgeOverdue : styles.badgeDue}`}>
                  {rec.taxPaid ? 'Pago' : isOverdue ? 'Atrasado' : 'Pendente'}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.taxRight}>
            <div className={styles.taxValues}>
              <span className={styles.taxSubLabel}>Lucro: {fmt(rec.profitLoss)}</span>
              <span className={`${styles.taxVal} ${valClass}`}>{fmt(rec.taxDue)}</span>
            </div>
            <ChevronDown size={16} className={`${styles.taxExpand} ${isExpanded ? styles.taxExpanded : ''}`}/>
          </div>
        </div>

        {isExpanded && (
          <div className={styles.taxDetails}>
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Valor Vendido</span>
                <span className={styles.detailVal}>{fmt(rec.sellValue)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Custo Médio</span>
                <span className={styles.detailVal}>{fmt(rec.costBasis)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Lucro</span>
                <span className={`${styles.detailVal} ${styles.valGood}`}>{fmt(rec.profitLoss)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Alíquota</span>
                <span className={styles.detailVal}>{(rec.taxRate * 100).toFixed(1)}%</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>IR Devido</span>
                <span className={`${styles.detailVal} ${styles.valWarn}`}>{fmt(rec.taxDue)}</span>
              </div>
              {rec.darfPeriod && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Competência</span>
                  <span className={styles.detailVal}>{rec.darfPeriod.replace('-','/')}</span>
                </div>
              )}
            </div>

            {!rec.taxPaid && (
              <div className={styles.darfActions}>
                <a
                  href="https://sicalc.receita.fazenda.gov.br/sicalc/rapido/contribuinte"
                  target="_blank" rel="noopener noreferrer"
                  className={styles.btnDarf}
                >
                  <ExternalLink size={13}/> Gerar DARF (Sicalc)
                </a>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={payDate[rec.id] || today}
                  onChange={e => setPayDate(p => ({ ...p, [rec.id]: e.target.value }))}
                  title="Data do pagamento"
                />
                <button className={styles.btnMarkPaid} onClick={() => handleMarkPaid(rec.id)}>
                  <CheckCircle size={13}/> Marcar como pago
                </button>
              </div>
            )}

            {rec.taxPaid && (
              <div className={styles.darfActions}>
                <span style={{ fontSize: '0.82rem', color: '#34D399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle size={14}/>
                  Pago em {rec.taxPaidAt ? new Date(rec.taxPaidAt + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </span>
                <button className={styles.btnUnpaid} onClick={() => handleMarkUnpaid(rec.id)}>
                  <RotateCcw size={12}/> Desfazer
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render Simple Row ──
  const renderSimpleRow = (rec: SellTaxRecord, badgeClass: string, badgeText: string, valueColor: string) => (
    <div key={rec.id} className={styles.simpleRow}>
      <div className={styles.simpleLeft}>
        <div
          className={styles.simpleAvatar}
          style={{ background: tickerColor(rec.assetTicker) }}
        >
          {rec.assetTicker.slice(0, 3)}
        </div>
        <div className={styles.simpleInfo}>
          <span className={styles.simpleTicker}>{rec.assetTicker}</span>
          <span className={styles.simpleDate}>{fmtDate(rec.sellDate)}</span>
        </div>
      </div>
      <div className={styles.simpleRight}>
        <span className={styles.simpleVal} style={{ color: valueColor }}>{fmt(Math.abs(rec.profitLoss))}</span>
        <span className={badgeClass}>{badgeText}</span>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            <Shield size={22} color="var(--color-primary)" />
            Impostos (IRPF)
          </h2>
          <button className={styles.methodologyLink} onClick={() => setShowMethodology(true)}>
            <ScrollText size={13} /> Entenda os cálculos
          </button>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.tabs}>
            {years.map(y => (
              <button
                key={y}
                className={`${styles.tabBtn} ${y === selectedYear ? styles.tabActive : ''}`}
                onClick={() => setSelectedYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
          <button className={styles.btnGhost} onClick={handleExport} disabled={records.length === 0}>
            <FileDown size={15}/> Exportar
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><Calendar size={36}/></div>
          <h2>Nenhuma venda em {selectedYear}</h2>
          <p>Os registros de vendas (lucros, prejuízos, impostos a pagar ou retidos) aparecerão aqui automaticamente quando você adicionar transações de venda.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className={summaryStyles.grid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div
              className={summaryStyles.card}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 16,
                padding: '1.1rem 1.25rem',
                ...(totalPending > 0 ? { borderColor: 'rgba(245,158,11,0.35)' } : {}),
              }}
            >
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>IR A PAGAR</span>
                <div className={`${summaryStyles.cardIcon} ${summaryStyles.iconWarning}`}><Clock size={14}/></div>
              </div>
              <div className={`${summaryStyles.cardValue} ${totalPending > 0 ? summaryStyles.valueWarning : ''}`}>
                {fmt(totalPending)}
              </div>
              <div className={summaryStyles.cardSub}>
                {overdueSells.length > 0
                  ? <span style={{ color: '#F87171' }}>⚠ {overdueSells.length} DARF(s) em atraso</span>
                  : 'Em DARFs pendentes'}
              </div>
            </div>

            <div
              className={summaryStyles.card}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 16,
                padding: '1.1rem 1.25rem',
                borderColor: 'rgba(16,185,129,0.3)',
              }}
            >
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>IR PAGO</span>
                <div className={`${summaryStyles.cardIcon} ${summaryStyles.iconSuccess}`}><CheckCircle size={14}/></div>
              </div>
              <div className={`${summaryStyles.cardValue} ${summaryStyles.valueSuccess}`}>{fmt(totalPaid)}</div>
              <div className={summaryStyles.cardSub}>Este ano</div>
            </div>

            <div
              className={summaryStyles.card}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 16,
                padding: '1.1rem 1.25rem',
              }}
            >
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>LUCROS ISENTOS</span>
                <div className={summaryStyles.cardIcon} style={{ background: 'rgba(96,165,250,0.14)', color: '#60A5FA' }}><Shield size={14}/></div>
              </div>
              <div className={summaryStyles.cardValue}>{fmt(totalExemptProfit)}</div>
              <div className={summaryStyles.cardSub}>Dentro do limite (ex: R$20k/mês)</div>
            </div>

            <div
              className={summaryStyles.card}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 16,
                padding: '1.1rem 1.25rem',
              }}
            >
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>PREJUÍZOS</span>
                <div className={`${summaryStyles.cardIcon} ${summaryStyles.iconLoss}`}><TrendingDown size={14}/></div>
              </div>
              <div className={`${summaryStyles.cardValue} ${summaryStyles.valueLoss}`}>{fmt(totalLoss)}</div>
              <div className={summaryStyles.cardSub}>Total apurado</div>
            </div>
          </div>

          {/* DARFs */}
          {sellsDue.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <CheckCircle size={17}/> DARFs / IR a Pagar
                </h3>
                <span className={styles.sectionCount}>{sellsDue.length}</span>
              </div>
              <div className={styles.list}>
                {sellsDue.map(rec => renderDarf(rec))}
              </div>
            </section>
          )}

          {/* Vendas Isentas */}
          {sellsExempt.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <Shield size={17}/> Vendas com Lucro Isento
                </h3>
                <span className={styles.sectionCount}>{sellsExempt.length}</span>
              </div>
              <div className={styles.list}>
                {sellsExempt.map(rec => renderSimpleRow(rec, styles.badgeExempt, 'Isento', '#34D399'))}
              </div>
            </section>
          )}

          {/* Renda Fixa / Retido na Fonte */}
          {sellsRfOrOther.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <Info size={17}/> Renda Fixa / Retido na Fonte
                </h3>
                <span className={styles.sectionCount}>{sellsRfOrOther.length}</span>
              </div>
              <div className={styles.list}>
                {sellsRfOrOther.map(rec => renderSimpleRow(rec, styles.badgeRetido, 'Retido', '#A78BFA'))}
              </div>
            </section>
          )}

          {/* Prejuízos e Compensação */}
          {sellsWithLoss.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <TrendingDown size={17}/> Prejuízos e Compensação
                </h3>
                <span className={styles.sectionCount}>{sellsWithLoss.length}</span>
              </div>

              <div className={styles.alertBox} style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.07)' }}>
                <Info size={17} color="#FBBF24" style={{ flexShrink: 0, marginTop: 2 }}/>
                <div>
                  <strong style={{ color: '#FBBF24', fontSize: '0.88rem' }}>Como funciona a compensação?</strong>
                  <p style={{ color: 'var(--color-text-2)', margin: '0.4rem 0 0', fontSize: '0.82rem' }}>
                    Prejuízos em <strong>operações comuns na bolsa</strong> abatem lucros futuros entre si; prejuízos em <strong>FII</strong> compensam apenas lucros de FII. Declare na ficha de Renda Variável do IRPF.{' '}
                    <strong>Cripto em exchange nacional, renda fixa e LCI/LCA não permitem compensação.</strong>
                  </p>
                </div>
              </div>

              <div className={styles.list}>
                {sellsWithLoss.map(rec => {
                  const compensable = isCompensable(rec);
                  const available = remaining(rec);
                  return (
                    <div key={rec.id} className={styles.simpleRow}>
                      <div className={styles.simpleLeft}>
                        <div className={styles.simpleAvatar} style={{ background: tickerColor(rec.assetTicker) }}>
                          {rec.assetTicker.slice(0, 3)}
                        </div>
                        <div className={styles.simpleInfo}>
                          <span className={styles.simpleTicker}>{rec.assetTicker}</span>
                          <span className={styles.simpleDate}>{fmtDate(rec.sellDate)}</span>
                          {!compensable && rec.assetType === 'crypto' && (
                            <span className={styles.simpleExtra}>⚠ Cripto em exchange nacional: apuração mensal definitiva.</span>
                          )}
                          {compensable && rec.lossUsedForCompensation > 0 && (
                            <span className={styles.simpleExtra}>✓ {fmt(rec.lossUsedForCompensation)} já utilizados.</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.simpleRight}>
                        <span className={styles.simpleVal} style={{ color: '#F87171' }}>-{fmt(Math.abs(rec.profitLoss))}</span>
                        <span className={compensable && available > 0 ? styles.badgeOk : styles.badgeLoss}>
                          {compensable ? `Disponível: ${fmt(available)}` : 'Não compensável'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {availableForComp > 0 && (
                  <div className={styles.compensacaoFooter}>
                    <div>
                      <div className={styles.compensacaoLabel}>Total disponível para compensar</div>
                      {compBolsa > 0 && compFii > 0 && (
                        <div className={styles.compensacaoSub}>Bolsa: {fmt(compBolsa)} · FII: {fmt(compFii)}</div>
                      )}
                    </div>
                    <span className={styles.compensacaoVal}>{fmt(availableForComp)}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Disclaimer */}
          <div className={styles.alertBox} style={{ borderColor: 'rgba(96,165,250,0.25)', background: 'rgba(96,165,250,0.05)' }}>
            <Info size={17} color="#60A5FA" style={{ flexShrink: 0, marginTop: 2 }}/>
            <div>
              <strong style={{ color: '#60A5FA', fontSize: '0.88rem' }}>Limitações deste cálculo — leia antes de declarar</strong>
              <ul style={{ color: 'var(--color-text-2)', margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.82rem' }}>
                <li>As isenções valem para o TOTAL vendido no mês em todas as corretoras — aqui só entram as vendas registradas no InvestMap.</li>
                <li><strong>Day trade</strong> (20%) não é diferenciado pelo app.</li>
                <li>Ativos no exterior seguem apuração anual (15%) da Lei 14.754/2023.</li>
                <li>Não substitui um contador. Verifique sempre no GCAP/IRPF da Receita.</li>
              </ul>
            </div>
          </div>
        </>
      )}

      {showMethodology && <TaxMethodologyModal onClose={() => setShowMethodology(false)} />}
    </div>
  );
}
