'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useTaxApuration } from '@/context/useTaxApuration';
import { AssetType, SellTaxRecord } from '@/types';
import {
  DarfApuration, DarfStatus, MonthApuration, SaleStatus, SALE_STATUS_LABEL,
  formatPeriod, ACOES_EXEMPTION_LIMIT, CRYPTO_EXEMPTION_LIMIT, DARF_MINIMUM,
} from '@/lib/taxApuration';
import { ASSET_TYPE_LABELS } from '@/lib/taxCalculator';
import {
  FileDown, Calendar, CheckCircle, Clock, Info, Shield, TrendingDown,
  ChevronDown, ExternalLink, RotateCcw, AlertTriangle, ScrollText, PencilLine,
} from 'lucide-react';
import styles from './Taxes.module.css';
import summaryStyles from '@/components/SummaryCards.module.css';
import TaxMethodologyModal from '@/components/TaxMethodologyModal';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => {
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
};
const parseBRL = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.'));

const SICALC_URL = 'https://sicalc.receita.fazenda.gov.br/sicalc/rapido/contribuinte';

const DARF_CODE_LABEL: Record<string, string> = {
  '6015': 'Renda variável (ações, ETFs, BDRs, FIIs)',
  '4600': 'Criptoativos (GCAP)',
};

const DARF_STATUS_LABEL: Record<DarfStatus, string> = {
  sem_ir: 'Sem IR',
  abaixo_minimo: 'Abaixo de R$ 10',
  pendente: 'Pendente',
  atrasado: 'Atrasado',
  pago: 'Pago',
  pago_a_mais: 'Pago a mais',
};

const GROUP_LABEL = { bolsa: 'Bolsa (ações, ETFs, BDRs)', fii: 'FII', cripto: 'Cripto' } as const;

const EDITABLE_TYPES: AssetType[] = ['acao', 'etf', 'bdr', 'fii', 'etf_rf', 'renda_fixa', 'lci_lca', 'crypto'];

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

function saleBadgeClass(st: SaleStatus): string {
  switch (st) {
    case 'tributavel': return styles.badgeWarn;
    case 'custo_pendente': return styles.badgeWarn;
    case 'isento': return styles.badgeExempt;
    case 'prejuizo': return styles.badgeLoss;
    case 'retido_fonte': return styles.badgeRetido;
    default: return styles.badgeOk;
  }
}

/** Situação mais grave entre os DARFs do mês — dá a cor do cartão. */
function monthTone(m: MonthApuration): 'overdue' | 'due' | 'paid' | 'neutral' {
  if (m.darfs.some(d => d.status === 'atrasado')) return 'overdue';
  if (m.darfs.some(d => d.status === 'pendente')) return 'due';
  if (m.darfs.some(d => d.status === 'pago' || d.status === 'pago_a_mais')) return 'paid';
  return 'neutral';
}

export default function Taxes() {
  const { sellTaxRecords, updateSellTaxRecord, addDarfPayment, removeDarfPayments } = useApp();
  const apuration = useTaxApuration();

  const years = useMemo(() => {
    const ySet = new Set<string>();
    sellTaxRecords.forEach(r => ySet.add(r.sellDate.substring(0, 4)));
    apuration.months.forEach(m => ySet.add(m.period.substring(0, 4)));
    const arr = Array.from(ySet).sort((a, b) => b.localeCompare(a));
    return arr.length > 0 ? arr : [new Date().getFullYear().toString()];
  }, [sellTaxRecords, apuration.months]);

  const [selectedYear, setSelectedYear] = useState(years[0]);
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [payDate, setPayDate] = useState<Record<string, string>>({});
  const [costInput, setCostInput] = useState<Record<string, string>>({});
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);

  // Data local (não UTC): à noite no Brasil o UTC já está no dia seguinte
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const records = useMemo(
    () => sellTaxRecords
      .filter(r => r.sellDate.startsWith(selectedYear))
      .sort((a, b) => b.sellDate.localeCompare(a.sellDate)),
    [sellTaxRecords, selectedYear],
  );
  const months = useMemo(
    () => apuration.months.filter(m => m.period.startsWith(selectedYear)).sort((a, b) => b.period.localeCompare(a.period)),
    [apuration.months, selectedYear],
  );
  const yearDarfs = months.flatMap(m => m.darfs);

  const totalOpen = yearDarfs.filter(d => d.status === 'pendente' || d.status === 'atrasado').reduce((s, d) => s + d.open, 0);
  const overdueCount = yearDarfs.filter(d => d.status === 'atrasado').length;
  const totalPaid = yearDarfs.reduce((s, d) => s + d.paid, 0);
  const totalExemptProfit = months.reduce(
    (s, m) => s + m.groups.bolsa.exemptProfit + m.groups.cripto.exemptProfit + m.lciLcaProfit, 0,
  );
  const carryTotal = apuration.lossCarry.bolsa + apuration.lossCarry.fii;
  const pendingCostRecords = records.filter(r => apuration.saleStatus[r.id] === 'custo_pendente');

  // ── Ações ──
  const handleMarkPaid = (d: DarfApuration) => {
    const key = `${d.period}-${d.code}`;
    addDarfPayment({ period: d.period, darfCode: d.code, amount: d.open, paidAt: payDate[key] || today });
  };

  const handleSaveCost = (rec: SellTaxRecord) => {
    const cost = parseBRL(costInput[rec.id] ?? '');
    if (!Number.isFinite(cost) || cost <= 0) return;
    const profitLoss = Math.round((rec.sellValue - cost) * 100) / 100;
    updateSellTaxRecord(rec.id, { costBasis: cost, profitLoss, isLoss: profitLoss < 0 });
    setCostInput(p => { const { [rec.id]: _drop, ...rest } = p; return rest; });
  };

  const handleCostInput = (id: string, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) { setCostInput(p => ({ ...p, [id]: '' })); return; }
    const num = parseInt(digits, 10) / 100;
    setCostInput(p => ({ ...p, [id]: num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
  };

  const handleChangeType = (rec: SellTaxRecord, type: AssetType) => {
    setEditingTypeId(null);
    if (type === rec.assetType) return;
    updateSellTaxRecord(rec.id, { assetType: type });
  };

  // ── Exportação ──
  const downloadCsv = (rows: (string | number)[][], filename: string) => {
    const csvVal = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + rows.map(r => r.map(csvVal).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  const num = (v: number) => v.toFixed(2).replace('.', ',');

  const handleExportSales = () => {
    downloadCsv([
      ['Data da venda', 'Ativo', 'Tipo tributário', 'Valor da venda', 'Custo de aquisição', 'Resultado', 'Situação na apuração', 'Competência'],
      ...records.map(r => {
        const pending = apuration.saleStatus[r.id] === 'custo_pendente';
        return [
          fmtDate(r.sellDate), r.assetTicker, ASSET_TYPE_LABELS[r.assetType] ?? r.assetType,
          num(r.sellValue), pending ? '' : num(r.costBasis), pending ? '' : num(r.sellValue - r.costBasis),
          SALE_STATUS_LABEL[apuration.saleStatus[r.id] ?? 'sem_resultado'], r.sellDate.slice(0, 7),
        ];
      }),
    ], `investmap-vendas-${selectedYear}.csv`);
  };

  const handleExportApuration = () => {
    const asc = [...months].reverse();
    downloadCsv([
      ['Competência', 'Grupo', 'Total vendido no mês', 'Resultado', 'Lucro isento', 'Prejuízo anterior', 'Prejuízo compensado', 'Base de cálculo', 'Alíquota (%)', 'IR apurado', 'Prejuízo a compensar (saldo)'],
      ...asc.flatMap(m => (['bolsa', 'fii', 'cripto'] as const)
        .filter(g => m.groups[g].salesVolume > 0)
        .map(g => {
          const x = m.groups[g];
          return [
            m.period, GROUP_LABEL[g], num(x.salesVolume), num(x.result), num(x.exemptProfit),
            num(x.lossCarryIn), num(x.lossUsed), num(x.base), (x.rate * 100).toFixed(1).replace('.', ','),
            num(x.tax), num(x.lossCarryOut),
          ];
        })),
      [],
      ['Competência', 'Código DARF', 'IR do mês', 'Acumulado de meses anteriores (< R$ 10)', 'Total', 'Pago', 'Em aberto', 'Vencimento', 'Situação'],
      ...asc.flatMap(m => m.darfs.map(d => [
        d.period, d.code, num(d.tax), num(d.carryIn), num(d.total), num(d.paid), num(d.open),
        fmtDate(d.dueDate), DARF_STATUS_LABEL[d.status] + (d.incomplete ? ' (custo pendente)' : ''),
      ])),
    ], `investmap-apuracao-ir-${selectedYear}.csv`);
  };

  // ── DARF de um mês × código ──
  const renderDarf = (d: DarfApuration) => {
    const key = `${d.period}-${d.code}`;
    const isOpen = d.status === 'pendente' || d.status === 'atrasado';
    const isPaid = d.status === 'pago' || d.status === 'pago_a_mais';
    return (
      <div key={key} className={styles.darfBlock}>
        <div className={styles.darfLine}>
          <div>
            <div className={styles.darfCode}>DARF {d.code} · {DARF_CODE_LABEL[d.code]}</div>
            <div className={styles.taxDate}>Vence em {fmtDate(d.dueDate)}</div>
          </div>
          <div className={styles.darfAmounts}>
            <span className={`${styles.taxVal} ${isPaid ? styles.valPaid : d.status === 'atrasado' ? styles.valOverdue : isOpen ? styles.valDue : ''}`}>
              {fmt(isOpen ? d.open : d.total)}
            </span>
            <span className={`${styles.taxBadge} ${isPaid ? styles.badgePaid : d.status === 'atrasado' ? styles.badgeOverdue : styles.badgeDue}`}>
              {d.complementar ? 'Complementar' : DARF_STATUS_LABEL[d.status]}
            </span>
          </div>
        </div>

        {d.carryIn > 0 && (
          <p className={styles.noteLine}>Inclui {fmt(d.carryIn)} de meses anteriores que ficaram abaixo do mínimo de R$ {DARF_MINIMUM},00.</p>
        )}
        {d.status === 'abaixo_minimo' && (
          <p className={styles.noteLine}>DARF abaixo de R$ {DARF_MINIMUM},00 não é recolhido: o valor passa para o próximo mês com IR a pagar.</p>
        )}
        {d.complementar && (
          <p className={styles.noteLine}>Você já pagou {fmt(d.paid)}, mas o IR do mês subiu para {fmt(d.total)} (venda registrada depois). Falta pagar a diferença.</p>
        )}
        {d.status === 'pago_a_mais' && (
          <p className={styles.noteLine}>Pago {fmt(d.paid)}, apurado {fmt(d.total)}. A diferença pode ser recuperada por PER/DCOMP — confirme com um contador.</p>
        )}
        {d.incomplete && (
          <p className={styles.noteLine} style={{ color: '#FBBF24' }}>
            <AlertTriangle size={12} style={{ verticalAlign: '-2px' }}/> Há venda com custo pendente neste mês — o valor é provisório até você informar o custo.
          </p>
        )}

        {isOpen && (
          <div className={styles.darfActions}>
            <a href={SICALC_URL} target="_blank" rel="noopener noreferrer" className={styles.btnDarf}>
              <ExternalLink size={13}/> Gerar DARF (Sicalc)
            </a>
            <input
              type="date"
              className={styles.dateInput}
              value={payDate[key] || today}
              onChange={e => setPayDate(p => ({ ...p, [key]: e.target.value }))}
              title="Data do pagamento"
            />
            <button className={styles.btnMarkPaid} onClick={() => handleMarkPaid(d)}>
              <CheckCircle size={13}/> Marcar {fmt(d.open)} como pago
            </button>
            {d.paid > 0 && (
              <button className={styles.btnUnpaid} onClick={() => removeDarfPayments(d.period, d.code)}>
                <RotateCcw size={12}/> Desfazer pagamentos
              </button>
            )}
          </div>
        )}
        {isPaid && (
          <div className={styles.darfActions}>
            <span style={{ fontSize: '0.82rem', color: '#34D399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle size={14}/> Pago {fmt(d.paid)}
            </span>
            <button className={styles.btnUnpaid} onClick={() => removeDarfPayments(d.period, d.code)}>
              <RotateCcw size={12}/> Desfazer
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Cartão de um mês ──
  const renderMonth = (m: MonthApuration) => {
    const isExpanded = expandedPeriod === m.period;
    const tone = monthTone(m);
    const cardClass = tone === 'overdue' ? styles.taxCardOverdue : tone === 'due' ? styles.taxCardDue : tone === 'paid' ? styles.taxCardPaid : '';
    const iconClass = tone === 'overdue' ? styles.iconOverdue : tone === 'paid' ? styles.iconPaid : styles.iconDue;
    const openTotal = m.darfs.filter(d => d.status === 'pendente' || d.status === 'atrasado').reduce((s, d) => s + d.open, 0);
    const taxTotal = m.darfs.reduce((s, d) => s + d.tax, 0);
    const groups = (['bolsa', 'fii', 'cripto'] as const).filter(g => m.groups[g].salesVolume > 0);

    return (
      <div key={m.period} className={`${styles.taxCard} ${cardClass}`}>
        <div className={styles.taxMain} onClick={() => setExpandedPeriod(isExpanded ? null : m.period)}>
          <div className={styles.taxInfo}>
            <div className={`${styles.taxIcon} ${iconClass}`}>
              {tone === 'paid' ? <CheckCircle size={18}/> : tone === 'overdue' ? <AlertTriangle size={18}/> : tone === 'due' ? <Clock size={18}/> : <Calendar size={18}/>}
            </div>
            <div className={styles.taxBody}>
              <div className={styles.taxTitle}>{formatPeriod(m.period)}</div>
              <div className={styles.taxMeta}>
                {m.darfs.length === 0 && <span className={styles.taxDate}>Sem DARF no mês</span>}
                {m.darfs.map(d => (
                  <span key={d.code} className={`${styles.taxBadge} ${d.status === 'pago' || d.status === 'pago_a_mais' ? styles.badgePaid : d.status === 'atrasado' ? styles.badgeOverdue : styles.badgeDue}`}>
                    {d.code} · {d.complementar ? 'Complementar' : DARF_STATUS_LABEL[d.status]}
                  </span>
                ))}
                {m.pendingCostCount > 0 && (
                  <span className={`${styles.taxBadge} ${styles.badgeOverdue}`}>Custo pendente</span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.taxRight}>
            <div className={styles.taxValues}>
              <span className={styles.taxSubLabel}>{openTotal > 0 ? 'Em aberto' : 'IR do mês'}</span>
              <span className={`${styles.taxVal} ${tone === 'overdue' ? styles.valOverdue : tone === 'due' ? styles.valDue : tone === 'paid' ? styles.valPaid : ''}`}>
                {fmt(openTotal > 0 ? openTotal : taxTotal)}
              </span>
            </div>
            <ChevronDown size={16} className={`${styles.taxExpand} ${isExpanded ? styles.taxExpanded : ''}`}/>
          </div>
        </div>

        {isExpanded && (
          <div className={styles.taxDetails}>
            {m.acoesSales > 0 && (
              <p className={styles.noteLine}>
                Ações vendidas no mês: <strong>{fmt(m.acoesSales)}</strong> —{' '}
                {m.acoesExempt
                  ? `dentro do limite de ${fmt(ACOES_EXEMPTION_LIMIT)}: lucro com ações isento.`
                  : `acima de ${fmt(ACOES_EXEMPTION_LIMIT)}: lucro com ações tributado.`}
              </p>
            )}
            {m.criptoSales > 0 && (
              <p className={styles.noteLine}>
                Cripto vendida no mês: <strong>{fmt(m.criptoSales)}</strong> —{' '}
                {m.criptoExempt
                  ? `dentro do limite de ${fmt(CRYPTO_EXEMPTION_LIMIT)}: isento.`
                  : `acima de ${fmt(CRYPTO_EXEMPTION_LIMIT)}: ganho tributado.`}
              </p>
            )}

            {groups.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.groupTable}>
                  <thead>
                    <tr>
                      <th>Grupo</th><th>Resultado</th><th>Isento</th><th>Prejuízo compensado</th><th>Base</th><th>IR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(g => {
                      const x = m.groups[g];
                      return (
                        <tr key={g}>
                          <td>{GROUP_LABEL[g]}</td>
                          <td style={{ color: x.result < 0 ? '#F87171' : undefined }}>{fmt(x.result)}</td>
                          <td>{x.exemptProfit > 0 ? fmt(x.exemptProfit) : '—'}</td>
                          <td>{x.lossUsed > 0 ? fmt(x.lossUsed) : '—'}</td>
                          <td>{fmt(x.base)}</td>
                          <td>{x.tax > 0 ? `${fmt(x.tax)} (${(x.rate * 100).toFixed(1).replace('.', ',')}%)` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {m.withheldProfit > 0 && (
              <p className={styles.noteLine}>
                Renda fixa com lucro de {fmt(m.withheldProfit)} — o IR é retido na fonte pelo banco/corretora, sem DARF.
              </p>
            )}

            {m.darfs.map(renderDarf)}
          </div>
        )}
      </div>
    );
  };

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
          <button className={styles.btnGhost} onClick={handleExportApuration} disabled={months.length === 0}>
            <FileDown size={15}/> Apuração
          </button>
          <button className={styles.btnGhost} onClick={handleExportSales} disabled={records.length === 0}>
            <FileDown size={15}/> Vendas
          </button>
        </div>
      </div>

      {records.length === 0 && months.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><Calendar size={36}/></div>
          <h2>Nenhuma venda em {selectedYear}</h2>
          <p>Quando você registrar vendas, o app apura o IR mês a mês: soma as vendas do mês, aplica as isenções, abate prejuízos anteriores e mostra o DARF a pagar.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className={summaryStyles.grid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div
              className={summaryStyles.card}
              style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 16, padding: '1.1rem 1.25rem',
                ...(totalOpen > 0 ? { borderColor: 'rgba(245,158,11,0.35)' } : {}),
              }}
            >
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>IR A PAGAR</span>
                <div className={`${summaryStyles.cardIcon} ${summaryStyles.iconWarning}`}><Clock size={14}/></div>
              </div>
              <div className={`${summaryStyles.cardValue} ${totalOpen > 0 ? summaryStyles.valueWarning : ''}`}>
                {fmt(totalOpen)}
              </div>
              <div className={summaryStyles.cardSub}>
                {overdueCount > 0
                  ? <span style={{ color: '#F87171' }}>⚠ {overdueCount} DARF(s) em atraso</span>
                  : 'Em DARFs mensais em aberto'}
              </div>
            </div>

            <div
              className={summaryStyles.card}
              style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 16, padding: '1.1rem 1.25rem', borderColor: 'rgba(16,185,129,0.3)',
              }}
            >
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>IR PAGO</span>
                <div className={`${summaryStyles.cardIcon} ${summaryStyles.iconSuccess}`}><CheckCircle size={14}/></div>
              </div>
              <div className={`${summaryStyles.cardValue} ${summaryStyles.valueSuccess}`}>{fmt(totalPaid)}</div>
              <div className={summaryStyles.cardSub}>Em DARF, competências de {selectedYear}</div>
            </div>

            <div
              className={summaryStyles.card}
              style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 16, padding: '1.1rem 1.25rem',
              }}
            >
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>LUCROS ISENTOS</span>
                <div className={summaryStyles.cardIcon} style={{ background: 'rgba(96,165,250,0.14)', color: '#60A5FA' }}><Shield size={14}/></div>
              </div>
              <div className={summaryStyles.cardValue}>{fmt(totalExemptProfit)}</div>
              <div className={summaryStyles.cardSub}>Ações ≤ R$ 20 mil/mês, cripto ≤ R$ 35 mil/mês, LCI/LCA</div>
            </div>

            <div
              className={summaryStyles.card}
              style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 16, padding: '1.1rem 1.25rem',
              }}
            >
              <div className={summaryStyles.cardTop}>
                <span className={summaryStyles.cardLabel}>PREJUÍZO A COMPENSAR</span>
                <div className={`${summaryStyles.cardIcon} ${summaryStyles.iconLoss}`}><TrendingDown size={14}/></div>
              </div>
              <div className={summaryStyles.cardValue}>{fmt(carryTotal)}</div>
              <div className={summaryStyles.cardSub}>
                Saldo atual · Bolsa {fmt(apuration.lossCarry.bolsa)} · FII {fmt(apuration.lossCarry.fii)}
              </div>
            </div>
          </div>

          {/* Custo pendente */}
          {pendingCostRecords.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <AlertTriangle size={17}/> Vendas com custo pendente
                </h3>
                <span className={styles.sectionCount}>{pendingCostRecords.length}</span>
              </div>
              <div className={styles.alertBox} style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.07)' }}>
                <Info size={17} color="#FBBF24" style={{ flexShrink: 0, marginTop: 2 }}/>
                <p style={{ color: 'var(--color-text-2)', margin: 0, fontSize: '0.82rem' }}>
                  O custo de aquisição destas vendas não foi encontrado (em geral, a compra é anterior ao extrato
                  importado da B3). Sem ele não dá para saber o lucro, então elas ficam <strong>fora do IR apurado</strong> —
                  mas o valor vendido já conta para o limite de isenção. Informe o custo total pago pelas unidades vendidas
                  (a nota de corretagem ou o informe de rendimentos da corretora trazem esse dado).
                </p>
              </div>
              <div className={styles.list}>
                {pendingCostRecords.map(rec => (
                  <div key={rec.id} className={styles.simpleRow}>
                    <div className={styles.simpleLeft}>
                      <div className={styles.simpleAvatar} style={{ background: tickerColor(rec.assetTicker) }}>
                        {rec.assetTicker.slice(0, 3)}
                      </div>
                      <div className={styles.simpleInfo}>
                        <span className={styles.simpleTicker}>{rec.assetTicker}</span>
                        <span className={styles.simpleDate}>{fmtDate(rec.sellDate)} · vendido por {fmt(rec.sellValue)}</span>
                      </div>
                    </div>
                    <div className={styles.inlineForm}>
                      <input
                        className={styles.costInput}
                        inputMode="numeric"
                        placeholder="Custo (R$)"
                        aria-label={`Custo de aquisição de ${rec.assetTicker}`}
                        value={costInput[rec.id] ?? ''}
                        onChange={e => handleCostInput(rec.id, e.target.value)}
                      />
                      <button
                        className={styles.btnMarkPaid}
                        disabled={!(parseBRL(costInput[rec.id] ?? '') > 0)}
                        onClick={() => handleSaveCost(rec)}
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Apuração mensal */}
          {months.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <Calendar size={17}/> Apuração mensal e DARFs
                </h3>
                <span className={styles.sectionCount}>{months.length}</span>
              </div>
              <div className={styles.list}>
                {months.map(renderMonth)}
              </div>
            </section>
          )}

          {/* Vendas do ano */}
          {records.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <TrendingDown size={17}/> Vendas de {selectedYear}
                </h3>
                <span className={styles.sectionCount}>{records.length}</span>
              </div>
              <div className={styles.list}>
                {records.map(rec => {
                  const st = apuration.saleStatus[rec.id] ?? 'sem_resultado';
                  const profit = rec.sellValue - rec.costBasis;
                  return (
                    <div key={rec.id} className={styles.simpleRow}>
                      <div className={styles.simpleLeft}>
                        <div className={styles.simpleAvatar} style={{ background: tickerColor(rec.assetTicker) }}>
                          {rec.assetTicker.slice(0, 3)}
                        </div>
                        <div className={styles.simpleInfo}>
                          <span className={styles.simpleTicker}>{rec.assetTicker}</span>
                          <span className={styles.simpleDate}>
                            {fmtDate(rec.sellDate)} · {fmt(rec.sellValue)} ·{' '}
                            {editingTypeId === rec.id ? (
                              <select
                                className={styles.typeSelect}
                                autoFocus
                                value={rec.assetType}
                                onChange={e => handleChangeType(rec, e.target.value as AssetType)}
                                onBlur={() => setEditingTypeId(null)}
                                aria-label="Tipo tributário"
                              >
                                {EDITABLE_TYPES.map(t => <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>)}
                              </select>
                            ) : (
                              <button className={styles.typeLink} onClick={() => setEditingTypeId(rec.id)} title="Corrigir o tipo tributário">
                                {ASSET_TYPE_LABELS[rec.assetType] ?? rec.assetType} <PencilLine size={11}/>
                              </button>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className={styles.simpleRight}>
                        {st !== 'custo_pendente' && (
                          <span className={styles.simpleVal} style={{ color: profit < 0 ? '#F87171' : '#34D399' }}>
                            {profit < 0 ? '-' : ''}{fmt(Math.abs(profit))}
                          </span>
                        )}
                        <span className={saleBadgeClass(st)}>{SALE_STATUS_LABEL[st]}</span>
                      </div>
                    </div>
                  );
                })}
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
                <li><strong>Day trade</strong> (20%) não é diferenciado pelo app, e o IRRF de 0,005% (&quot;dedo-duro&quot;) não é abatido do DARF.</li>
                <li>Ativos no exterior seguem apuração anual (15%) da Lei 14.754/2023.</li>
                <li>O vencimento não considera feriados nacionais — confira a data no Sicalc.</li>
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
