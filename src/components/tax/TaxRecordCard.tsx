'use client';

import { SellTaxRecord } from '@/types';
import styles from '@/components/PortfolioHistory.module.css';
import { CheckCircle, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface TaxRecordCardProps {
  rec: SellTaxRecord;
  expanded: boolean;
  onToggle: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
  dateValue: string;
  onDateChange: (v: string) => void;
}

export default function TaxRecordCard({ rec, expanded, onToggle, onMarkPaid, onMarkUnpaid, dateValue, onDateChange }: TaxRecordCardProps) {
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
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
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
