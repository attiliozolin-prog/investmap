/**
 * taxCalculator.ts — Motor de Cálculo de IR em Investimentos (Brasil 2026)
 *
 * Regras aplicadas:
 * - Ações (B3): 15% sobre lucro; isenção se total de vendas no mês ≤ R$ 20.000
 * - ETF de Renda Variável: 15% sobre lucro, sem isenção de R$ 20k
 * - FII (Fundos de Investimento Imobiliário): 20% sobre lucro, sem isenção
 * - LCI / LCA: Isento para Pessoa Física
 * - Renda Fixa (CDB, Tesouro Direto, etc): Tabela regressiva de 22,5% → 15%
 * - Crypto: isenção se total de vendas no mês ≤ R$ 35.000; acima disso, alíquota
 *   progressiva de 15% a 22,5% sobre o lucro (Lei 14.478/2022 + IN 2.180/2024)
 *
 * Referências:
 * - IN RFB 1.022/2010 e atualizações
 * - Lei 11.033/2004 (isenção ações)
 * - Lei 8.668/93 e art. 3º Lei 11.033 (FII)
 * - Lei 14.478/2022 + IN RFB 2.180/2024 (criptoativos)
 */

import { AssetType, TaxCalculation } from '@/types';

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  acao:       'Ação (B3)',
  etf:        'ETF de Renda Variável',
  fii:        'Fundo de Investimento Imobiliário (FII)',
  lci_lca:    'LCI / LCA',
  renda_fixa: 'Renda Fixa (CDB / Tesouro / etc)',
  crypto:     'Criptoativo',
};

// Tickers conhecidos de crypto para detecção automática
const CRYPTO_TICKERS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'BNB', 'AVAX', 'DOT',
  'MATIC', 'LINK', 'ATOM', 'USDT', 'USDC', 'ALTCOINS', 'CRIPTO',
];

/**
 * Detecta o tipo tributário do ativo com base no className da estratégia e no ticker.
 */
export function detectAssetType(className: string, subclassName: string, ticker: string): AssetType {
  const cls  = className.toLowerCase();
  const sub  = subclassName.toLowerCase();
  const tick = ticker.toUpperCase();

  // ── Crypto ────────────────────────────────────────────────────────────────
  if (
    cls.includes('cripto') || cls.includes('crypto') || cls.includes('criptoativo') ||
    sub.includes('cripto') || sub.includes('crypto') || sub.includes('bitcoin') ||
    CRYPTO_TICKERS.some(c => tick === c || tick.startsWith(c))
  ) {
    return 'crypto';
  }

  // ── Renda Fixa ────────────────────────────────────────────────────────────
  if (cls.includes('renda fixa') || sub.includes('renda fixa') || sub.includes('tesouro') || sub.includes('cdb') || sub.includes('lc')) {
    if (sub.includes('lci') || sub.includes('lca') || tick.includes('LCI') || tick.includes('LCA')) {
      return 'lci_lca';
    }
    return 'renda_fixa';
  }

  // ── FII ───────────────────────────────────────────────────────────────────
  if (
    sub.includes('fii') || sub.includes('fundo imob') ||
    (tick.endsWith('11') && ['HGLG','MXRF','XPML','VISC','BRCO','KNRI','HGRU','TAEE'].some(f => tick.startsWith(f)))
  ) {
    return 'fii';
  }

  // ── ETF ───────────────────────────────────────────────────────────────────
  if (sub.includes('etf') || (tick.endsWith('11') && !sub.includes('ação') && !sub.includes('dividend'))) {
    return 'etf';
  }

  return 'acao';
}

/**
 * Calcula os dias entre a data de compra (aproximada pelo createdAt) e a data de venda.
 */
function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to   = new Date(toIso).getTime();
  return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
}

/**
 * Retorna alíquota da tabela regressiva de renda fixa conforme prazo em dias.
 */
function rendaFixaAliquota(days: number): number {
  if (days <= 180)  return 0.225;
  if (days <= 360)  return 0.20;
  if (days <= 720)  return 0.175;
  return 0.15;
}

/**
 * Alíquota progressiva para ganho de capital em crypto (Lei 14.478/2022).
 * Aplica-se sobre o LUCRO total (não sobre o valor de venda).
 */
function cryptoAliquota(profitLoss: number): number {
  if (profitLoss <= 5_000_000)  return 0.15;
  if (profitLoss <= 10_000_000) return 0.175;
  if (profitLoss <= 30_000_000) return 0.20;
  return 0.225;
}

/**
 * Ponto de entrada principal.
 *
 * @param assetType                tipo tributário do ativo
 * @param sellValue                valor total recebido na venda (R$)
 * @param costBasis                custo médio proporcional (R$)
 * @param sellDate                 data da venda (YYYY-MM-DD)
 * @param assetCreatedAt           data de criação/compra (ISO) — usado em renda fixa
 * @param monthlySalesOfSameType   total já vendido no mês neste tipo (isenção R$ 20k ações / R$ 35k crypto)
 */
export function calculateTax(
  assetType: AssetType,
  sellValue: number,
  costBasis: number,
  sellDate: string,
  assetCreatedAt?: string,
  monthlySalesOfSameType = 0,
): TaxCalculation {
  const profitLoss = sellValue - costBasis;
  const isLoss = profitLoss < 0;
  const darfPeriod = sellDate.slice(0, 7); // YYYY-MM
  const monthYear = formatMonthYear(darfPeriod);
  const assetTypeLabel = ASSET_TYPE_LABELS[assetType];

  const darfUrl = `https://sicalc.receita.fazenda.gov.br/sicalc/rapido/contribuinte`;

  let isExempt = false;
  let exemptReason: string | undefined;
  let taxRate = 0;
  let taxDue = 0;
  const explanation: string[] = [];

  // ── PREJUÍZO ─────────────────────────────────────────────────────────────
  if (isLoss) {
    const prejLabel = assetType === 'crypto' ? 'criptoativos' : 'ativos do mesmo tipo';
    explanation.push(`❌ Esta venda resultou em um PREJUÍZO de R$ ${fmt(Math.abs(profitLoss))}.`);
    explanation.push(`💡 Você não deve pagar IR quando há prejuízo.`);
    explanation.push(`📋 É obrigatório declarar a venda no IRPF.`);
    explanation.push(`🔄 O prejuízo pode ser compensado com lucros futuros em ${prejLabel} — mantenha o controle neste histórico!`);

    return {
      assetType, assetTypeLabel, sellValue, costBasis, profitLoss, isLoss,
      isExempt: true, exemptReason: 'Venda com prejuízo',
      taxRate: 0, taxDue: 0, darfPeriod, darfUrl, explanation,
    };
  }

  // ── AÇÕES ────────────────────────────────────────────────────────────────
  if (assetType === 'acao') {
    const totalMonthSales = monthlySalesOfSameType + sellValue;
    taxRate = 0.15;

    if (totalMonthSales <= 20000) {
      isExempt = true;
      exemptReason = `Total de vendas de ações no mês (R$ ${fmt(totalMonthSales)}) dentro do limite de isenção de R$ 20.000,00`;
      taxDue = 0;
      explanation.push(`✅ ISENTO — Suas vendas de ações em ${monthYear} somam R$ ${fmt(totalMonthSales)}, abaixo do teto de R$ 20.000 mensais.`);
      explanation.push(`📌 Base legal: Art. 3º, § 2º, da Lei 11.033/2004.`);
      explanation.push(`📋 Mesmo isento, declare a venda no IRPF (aba "Renda Variável").`);
    } else {
      taxDue = profitLoss * taxRate;
      explanation.push(`💸 Lucro realizado: R$ ${fmt(profitLoss)}`);
      explanation.push(`⚠️ Suas vendas de ações em ${monthYear} somam R$ ${fmt(totalMonthSales)}, acima do limite de isenção de R$ 20.000.`);
      explanation.push(`📌 Alíquota: 15% sobre o lucro (art. 2º da Lei 11.033/2004).`);
      explanation.push(`🧾 IR devido: R$ ${fmt(taxDue)}`);
      explanation.push(`📅 Vencimento do DARF: ${nextMonthDue(darfPeriod)}.`);
      explanation.push(`🔗 Código do DARF para ações: 6015.`);
    }
  }

  // ── ETF ──────────────────────────────────────────────────────────────────
  else if (assetType === 'etf') {
    taxRate = 0.15;
    taxDue = profitLoss * taxRate;
    explanation.push(`💸 Lucro realizado: R$ ${fmt(profitLoss)}`);
    explanation.push(`⚠️ ETFs de renda variável NÃO têm isenção por limite de vendas mensais.`);
    explanation.push(`📌 Alíquota: 15% sobre o lucro (IN RFB 1.585/2015).`);
    explanation.push(`🧾 IR devido: R$ ${fmt(taxDue)}`);
    explanation.push(`📅 Vencimento do DARF: ${nextMonthDue(darfPeriod)}.`);
    explanation.push(`🔗 Código do DARF para ETFs: 6015.`);
  }

  // ── FII ──────────────────────────────────────────────────────────────────
  else if (assetType === 'fii') {
    taxRate = 0.20;
    taxDue = profitLoss * taxRate;
    explanation.push(`💸 Lucro realizado: R$ ${fmt(profitLoss)}`);
    explanation.push(`⚠️ FIIs tributam o ganho de capital à alíquota de 20%, sem isenção.`);
    explanation.push(`📌 Base legal: Art. 2º da Lei 8.668/93 e art. 3º da Lei 11.033/2004.`);
    explanation.push(`🧾 IR devido: R$ ${fmt(taxDue)}`);
    explanation.push(`📅 Vencimento do DARF: ${nextMonthDue(darfPeriod)}.`);
    explanation.push(`🔗 Código do DARF para FIIs: 6015.`);
  }

  // ── LCI / LCA ────────────────────────────────────────────────────────────
  else if (assetType === 'lci_lca') {
    isExempt = true;
    exemptReason = 'LCI e LCA são isentos de IR para Pessoa Física';
    explanation.push(`✅ ISENTO — LCI e LCA são completamente isentos de IR para Pessoa Física.`);
    explanation.push(`📌 Base legal: Art. 3º, inciso IV, da Lei 11.033/2004.`);
    explanation.push(`📋 Informe o rendimento no IRPF (aba "Rendimentos Isentos e Não Tributáveis").`);
  }

  // ── RENDA FIXA ───────────────────────────────────────────────────────────
  else if (assetType === 'renda_fixa') {
    const days = assetCreatedAt ? daysBetween(assetCreatedAt, sellDate) : 721;
    taxRate = rendaFixaAliquota(days);
    taxDue = profitLoss * taxRate;
    const taxRatePct = (taxRate * 100).toFixed(1);

    explanation.push(`💸 Rendimento obtido: R$ ${fmt(profitLoss)}`);
    explanation.push(`📅 Prazo estimado de aplicação: ${days} dias.`);
    explanation.push(`📌 Alíquota da tabela regressiva (${days} dias): ${taxRatePct}%.`);
    explanation.push(`  • Até 180 dias: 22,5%  |  181–360 dias: 20%  |  361–720 dias: 17,5%  |  > 720 dias: 15%`);
    explanation.push(`🧾 IR estimado sobre o rendimento: R$ ${fmt(taxDue)}`);
    explanation.push(`✅ Para CDB, Tesouro Direto e similares, o IR é retido na fonte pelo banco. Você não precisa emitir DARF.`);
    explanation.push(`📋 Informe o rendimento no IRPF (aba "Rendimentos Sujeitos à Tributação Exclusiva/Definitiva").`);
  }

  // ── CRYPTO ───────────────────────────────────────────────────────────────
  else if (assetType === 'crypto') {
    const totalMonthSales = monthlySalesOfSameType + sellValue;
    const ISENCAO_CRYPTO = 35_000;

    if (totalMonthSales <= ISENCAO_CRYPTO) {
      // Isenção: total de vendas de crypto no mês ≤ R$ 35.000
      isExempt = true;
      exemptReason = `Total de vendas de criptoativos no mês (R$ ${fmt(totalMonthSales)}) está dentro do limite de isenção de R$ 35.000,00`;
      taxRate = 0;
      taxDue = 0;
      explanation.push(`✅ ISENTO — Suas vendas de criptoativos em ${monthYear} somam R$ ${fmt(totalMonthSales)}, abaixo do teto de isenção de R$ 35.000.`);
      explanation.push(`📌 Base legal: Lei 14.478/2022 + IN RFB 2.180/2024.`);
      explanation.push(`📋 Mesmo isento, declare a venda no IRPF (aba "Renda Variável – Operações com Criptoativos").`);
    } else {
      // Tributável: alíquota progressiva sobre o lucro
      taxRate = cryptoAliquota(profitLoss);
      taxDue = profitLoss * taxRate;
      const taxRatePct = (taxRate * 100).toFixed(1);

      explanation.push(`💸 Lucro realizado: R$ ${fmt(profitLoss)}`);
      explanation.push(`⚠️ Suas vendas de criptoativos em ${monthYear} somam R$ ${fmt(totalMonthSales)}, acima do limite de isenção de R$ 35.000.`);
      explanation.push(`📌 Alíquota progressiva aplicável: ${taxRatePct}% (Lei 14.478/2022).`);
      explanation.push(`  • Lucro ≤ R$ 5M: 15%  |  R$ 5M–10M: 17,5%  |  R$ 10M–30M: 20%  |  > R$ 30M: 22,5%`);
      explanation.push(`🧾 IR devido: R$ ${fmt(taxDue)}`);
      explanation.push(`📅 Vencimento do DARF: ${nextMonthDue(darfPeriod)}.`);
      explanation.push(`🔗 Código do DARF para criptoativos: 4600.`);
      explanation.push(`📋 Declare também no IRPF (aba "Renda Variável – Operações com Criptoativos").`);
    }
  }

  return {
    assetType, assetTypeLabel, sellValue, costBasis, profitLoss, isLoss,
    isExempt, exemptReason, taxRate, taxDue, darfPeriod, darfUrl, explanation,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMonthYear(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${months[parseInt(m) - 1]}/${y}`;
}

function nextMonthDue(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  return `último dia útil de ${formatMonthYear(`${next.y}-${String(next.m).padStart(2,'0')}`)}`;
}
