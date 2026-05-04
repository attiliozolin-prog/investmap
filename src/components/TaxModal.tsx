'use client';

import React from 'react';
import { TaxCalculation } from '@/types';
import { X, ExternalLink, AlertTriangle, CheckCircle, TrendingDown, Info } from 'lucide-react';
import styles from './TaxModal.module.css';

interface Props {
  calc: TaxCalculation;
  ticker: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function TaxModal({ calc, ticker, onConfirm, onCancel }: Props) {
  const isPrejuizo = calc.isLoss;
  const isento = calc.isExempt && !isPrejuizo;
  const temIR = !calc.isExempt && !isPrejuizo && calc.taxDue > 0;

  const accentColor = isPrejuizo ? '#EF4444' : isento ? '#10B981' : '#F59E0B';

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* ── Header ──────────────────────────────────────────── */}
        <div className={styles.header} style={{ borderColor: accentColor }}>
          <div className={styles.headerLeft}>
            {isPrejuizo && <TrendingDown size={22} color="#EF4444" />}
            {isento    && <CheckCircle  size={22} color="#10B981" />}
            {temIR     && <AlertTriangle size={22} color="#F59E0B" />}
            {!isPrejuizo && !isento && !temIR && <Info size={22} color="#60A5FA" />}
            <div>
              <h3 className={styles.title}>
                {isPrejuizo ? 'Venda com Prejuízo' : isento ? 'Venda Isenta de IR' : 'Imposto de Renda Devido'}
              </h3>
              <span className={styles.subtitle}>{ticker} · {calc.assetTypeLabel}</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        {/* ── Cards de resumo ─────────────────────────────────── */}
        <div className={styles.cards}>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Valor da venda</span>
            <span className={styles.cardValue}>{fmt(calc.sellValue)}</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Custo médio</span>
            <span className={styles.cardValue}>{fmt(calc.costBasis)}</span>
          </div>
          <div className={styles.card} style={{ border: `1px solid ${accentColor}40` }}>
            <span className={styles.cardLabel}>{isPrejuizo ? 'Prejuízo realizado' : 'Lucro realizado'}</span>
            <span className={styles.cardValue} style={{ color: accentColor }}>
              {fmt(Math.abs(calc.profitLoss))}
            </span>
          </div>
          {temIR && (
            <>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Alíquota</span>
                <span className={styles.cardValue}>{fmtPct(calc.taxRate)}</span>
              </div>
              <div className={styles.card} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <span className={styles.cardLabel}>⚠️ IR a pagar</span>
                <span className={styles.cardValue} style={{ color: '#F59E0B', fontSize: '1.2rem' }}>
                  {fmt(calc.taxDue)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Explicação didática ─────────────────────────────── */}
        <div className={styles.explanation}>
          {calc.explanation.map((line, i) => (
            <p key={i} className={styles.explanationLine}>{line}</p>
          ))}
        </div>

        {/* ── Link DARF ───────────────────────────────────────── */}
        {temIR && (
          <a
            href={calc.darfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.darfLink}
          >
            <ExternalLink size={15} />
            Gerar DARF no Sicalc da Receita Federal
            <span className={styles.darfPeriod}>· Competência: {calc.darfPeriod.replace('-', '/')}</span>
          </a>
        )}

        {/* ── Aviso sobre declaração ──────────────────────────── */}
        <div className={styles.notice}>
          <Info size={13} />
          <span>Esta é uma estimativa informativa. Consulte sempre um contador ou a Receita Federal para situações específicas.</span>
        </div>

        {/* ── Ações ───────────────────────────────────────────── */}
        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onCancel}>
            ← Cancelar venda
          </button>
          <button className={styles.btnConfirm} onClick={onConfirm}>
            {isPrejuizo ? 'Registrar prejuízo' : isento ? 'Confirmar venda (isenta)' : 'Confirmar venda (ciente do IR)'}
          </button>
        </div>
      </div>
    </div>
  );
}
