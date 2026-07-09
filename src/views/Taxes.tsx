'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { SellTaxRecord } from '@/types';
import { FileDown, Calendar, CheckCircle, Clock, Info, Shield, TrendingDown } from 'lucide-react';
import styles from './Taxes.module.css';
import summaryStyles from '@/components/SummaryCards.module.css';
import TaxRecordCard from '@/components/tax/TaxRecordCard';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

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

  const records = useMemo(() => sellTaxRecords.filter(r => r.sellDate.startsWith(selectedYear)), [sellTaxRecords, selectedYear]);
  const sorted = useMemo(() => [...records].sort((a, b) => b.sellDate.localeCompare(a.sellDate)), [records]);

  // Grupos
  const sellsDue = sorted.filter(r => r.taxDue > 0);
  const sellsExempt = sorted.filter(r => r.taxDue === 0 && r.profitLoss > 0 && r.isExempt);
  const sellsRfOrOther = sorted.filter(r => r.taxDue === 0 && r.profitLoss > 0 && !r.isExempt && (r.assetType === 'renda_fixa' || r.assetType === 'lci_lca'));
  const sellsWithLoss = sorted.filter(r => r.profitLoss < 0);

  const pendingSells = sellsDue.filter(r => !r.taxPaid);
  const totalPending = pendingSells.reduce((s, r) => s + r.taxDue, 0);
  const totalPaid = sellsDue.filter(r => r.taxPaid).reduce((s, r) => s + r.taxDue, 0);

  const totalExemptProfit = sellsExempt.reduce((s, r) => s + r.profitLoss, 0);
  const totalLoss = sellsWithLoss.reduce((s, r) => s + r.profitLoss, 0);

  // Compensação
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
      fmtDate(r.sellDate),
      r.assetTicker,
      r.assetType,
      num(r.sellValue),
      num(r.costBasis),
      num(r.profitLoss),
      r.profitLoss < 0 ? 'Prejuízo' : r.isExempt ? 'Isento' : r.taxDue > 0 ? 'Tributável' : 'Retido na fonte',
      r.exemptReason ?? '',
      (r.taxRate * 100).toFixed(1).replace('.', ','),
      num(r.taxDue),
      r.taxPaid ? 'Sim' : 'Não',
      r.taxPaidAt ? fmtDate(r.taxPaidAt) : '',
      r.darfPeriod ?? '',
    ].map(csvVal).join(';'));

    // (BOM) faz o Excel abrir o arquivo com acentuação correta
    const csv = '\uFEFF' + [header.map(csvVal).join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investmap-ir-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMarkPaid = (id: string) => {
    const dateToUse = payDate[id] || new Date().toISOString().split('T')[0];
    updateSellTaxRecord(id, { taxPaid: true, taxPaidAt: dateToUse });
  };

  const handleMarkUnpaid = (id: string) => {
    updateSellTaxRecord(id, { taxPaid: false, taxPaidAt: undefined });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}><Shield size={22} color="var(--color-primary)" /> Impostos (IRPF)</h2>
        <div className={styles.headerActions}>
          {years.length > 1 ? (
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
          ) : (
            <div className={styles.tabs}>
              <button className={`${styles.tabBtn} ${styles.tabActive}`}>{selectedYear}</button>
            </div>
          )}
          <button className={styles.btnGhost} onClick={handleExport} disabled={records.length === 0}>
            <FileDown size={15} /> Exportar
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Calendar size={36} />
          </div>
          <div>
            <h2>Nenhuma venda em {selectedYear}</h2>
            <p>Os registros de vendas (lucros, prejuízos, impostos a pagar ou retidos) aparecerão aqui automaticamente quando você adicionar transações de venda.</p>
          </div>
        </div>
      ) : (
        <>
          <div className={summaryStyles.grid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className={summaryStyles.card} style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>IR A PAGAR</span>
                <div className={`${summaryStyles.cardIcon} ${summaryStyles.iconWarning}`}><Clock size={15}/></div>
              </div>
              <div className={`${summaryStyles.cardValue} ${summaryStyles.valueWarning}`}>{fmt(totalPending)}</div>
              <div className={summaryStyles.cardSub}>Em DARFs pendentes</div>
            </div>

            <div className={summaryStyles.card} style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>IR PAGO</span>
                <div className={`${summaryStyles.cardIcon} ${summaryStyles.iconSuccess}`}><CheckCircle size={15}/></div>
              </div>
              <div className={`${summaryStyles.cardValue} ${summaryStyles.valueSuccess}`}>{fmt(totalPaid)}</div>
              <div className={summaryStyles.cardSub}>Este ano</div>
            </div>

            <div className={summaryStyles.card}>
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>LUCROS ISENTOS</span>
                <div className={`${summaryStyles.cardIcon}`} style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}><Shield size={15}/></div>
              </div>
              <div className={summaryStyles.cardValue}>{fmt(totalExemptProfit)}</div>
              <div className={summaryStyles.cardSub}>Dentro do limite (ex: 20k)</div>
            </div>

            <div className={summaryStyles.card}>
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>PREJUÍZOS</span>
                <div className={`${summaryStyles.cardIcon} ${summaryStyles.iconLoss}`}><TrendingDown size={15}/></div>
              </div>
              <div className={`${summaryStyles.cardValue} ${summaryStyles.valueLoss}`}>{fmt(totalLoss)}</div>
              <div className={summaryStyles.cardSub}>Total apurado</div>
            </div>
          </div>

          {sellsDue.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}><CheckCircle size={16}/> DARFs / IR a Pagar</h3>
              <div className={styles.list}>
                {sellsDue.map(rec => (
                  <TaxRecordCard
                    key={rec.id}
                    rec={rec}
                    expanded={expandedId === rec.id}
                    onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                    onMarkPaid={() => handleMarkPaid(rec.id)}
                    onMarkUnpaid={() => handleMarkUnpaid(rec.id)}
                    dateValue={payDate[rec.id] || new Date().toISOString().split('T')[0]}
                    onDateChange={(val) => setPayDate(p => ({ ...p, [rec.id]: val }))}
                  />
                ))}
              </div>
            </section>
          )}

          {sellsExempt.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}><Shield size={16}/> Vendas com Lucro Isento</h3>
              <div className={styles.list}>
                {sellsExempt.map(rec => (
                  <div key={rec.id} className={styles.simpleRow}>
                    <div className={styles.simpleInfo}>
                      <span className={styles.simpleTicker}>{rec.assetTicker}</span>
                      <span className={styles.simpleDate}>{fmtDate(rec.sellDate)}</span>
                    </div>
                    <div className={styles.simpleRight}>
                      <span className={styles.simpleVal} style={{ color: '#34D399' }}>{fmt(rec.profitLoss)}</span>
                      <span className={styles.badgeExempt}>Isento</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sellsRfOrOther.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}><Info size={16}/> Renda Fixa / Retido na Fonte</h3>
              <div className={styles.list}>
                {sellsRfOrOther.map(rec => (
                  <div key={rec.id} className={styles.simpleRow}>
                    <div className={styles.simpleInfo}>
                      <span className={styles.simpleTicker}>{rec.assetTicker}</span>
                      <span className={styles.simpleDate}>{fmtDate(rec.sellDate)}</span>
                    </div>
                    <div className={styles.simpleRight}>
                      <span className={styles.simpleVal} style={{ color: '#34D399' }}>{fmt(rec.profitLoss)}</span>
                      <span className={styles.badgeExempt}>Retido na Fonte</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sellsWithLoss.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}><TrendingDown size={16}/> Prejuízos e Compensação</h3>
              <div className={styles.alertBox} style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)' }}>
                <Info size={18} color="#FBBF24" style={{ flexShrink: 0, marginTop: '2px' }}/>
                <div>
                  <strong style={{ color: '#FBBF24', fontSize: '0.9rem' }}>Como funciona a compensação?</strong>
                  <p>
                    Prejuízos em <strong>operações comuns na bolsa</strong> abatem lucros futuros entre si;
                    prejuízos em <strong>FII</strong> compensam apenas lucros de FII. Declare na ficha de Renda Variável do IRPF.{' '}
                    <strong>Cripto em exchange nacional, renda fixa e LCI/LCA não permitem compensação.</strong>
                  </p>
                </div>
              </div>
              <div className={styles.list} style={{ marginBottom: '0.8rem' }}>
                {sellsWithLoss.map(rec => {
                  const compensable = isCompensable(rec);
                  const available = remaining(rec);
                  return (
                    <div key={rec.id} className={styles.simpleRow}>
                      <div className={styles.simpleInfo}>
                        <span className={styles.simpleTicker}>{rec.assetTicker}</span>
                        <span className={styles.simpleDate}>{fmtDate(rec.sellDate)}</span>
                        {!compensable && rec.assetType === 'crypto' && (
                          <div className={styles.simpleExtra}>⚠️ Cripto em exchange nacional: apuração mensal definitiva.</div>
                        )}
                        {compensable && rec.lossUsedForCompensation > 0 && (
                          <div className={styles.simpleExtra}>✅ {fmt(rec.lossUsedForCompensation)} já utilizados em compensações.</div>
                        )}
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
              </div>
              
              <div style={{ textAlign: 'right', padding: '0 0.5rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--color-text-2)' }}>
                  Total disponível para compensar
                  {compBolsa > 0 && compFii > 0 && (
                    <span>{' '}(bolsa: {fmt(compBolsa)} · FII: {fmt(compFii)})</span>
                  )}
                  :
                </span>
                <strong style={{ color: '#FBBF24', marginLeft: '0.5rem', fontSize: '1.05rem' }}>{fmt(availableForComp)}</strong>
              </div>
            </section>
          )}

          <div className={styles.alertBox} style={{ borderColor: 'rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.06)' }}>
            <Info size={18} color="#60A5FA" style={{ flexShrink: 0, marginTop: '2px' }}/>
            <div>
              <strong style={{ color: '#60A5FA', fontSize: '0.9rem' }}>Limitações deste cálculo — leia antes de declarar</strong>
              <ul style={{ color: 'var(--color-text-2)' }}>
                <li>As isenções valem para o TOTAL vendido no mês em todas as corretoras — aqui só entram as vendas registradas no InvestMap.</li>
                <li><strong>Day trade</strong> (20%) não é diferenciado pelo app.</li>
                <li>Ativos no exterior seguem apuração anual (15%) da Lei 14.754/2023.</li>
                <li>Não substitui um contador. Verifique sempre no GCAP/IRPF da Receita.</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
