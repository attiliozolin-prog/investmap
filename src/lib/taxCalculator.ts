/**
 * taxCalculator.ts — Motor de Cálculo de IR em Investimentos (Brasil 2026)
 *
 * Regras aplicadas:
 * - Ações (B3): 15% sobre lucro; isenção se total de vendas no mês ≤ R$ 20.000
 * - ETF de Renda Variável: 15% sobre lucro, sem isenção de R$ 20k
 * - FII (Fundos de Investimento Imobiliário): 20% sobre lucro, sem isenção
 * - LCI / LCA: Isento para Pessoa Física
 * - Renda Fixa (CDB, Tesouro Direto, etc): Tabela regressiva de 22,5% → 15%
 *
 * Referências:
 * - IN RFB 1.022/2010 e atualizações
 * - Lei 11.033/2004 (isenção ações)
 * - Lei 8.668/93 e art. 3º Lei 11.033 (FII)
 */

import { AssetType, TaxCalculation } from '@/types';

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  acao:       'Ação (B3)',
  etf:        'ETF de Renda Variável',
  fii:        'Fundo de Investimento Imobiliário (FII)',
  lci_lca:    'LCI / LCA',
  renda_fixa: 'Renda Fixa (CDB / Tesouro / etc)',
};

/**
 * Detecta o tipo tributário do ativo com base no className da estratégia e no ticker.
 */
export function detectAssetType(className: string, subclassName: string, ticker: string): AssetType {
  const cls = className.toLowerCase();
  const sub = subclassName.toLowerCase();
  const tick = ticker.toUpperCase();

  if (cls.includes('renda fixa') || sub.includes('renda fixa') || sub.includes('tesouro') || sub.includes('cdb') || sub.includes('lc')) {
    // LCI e LCA — isentos para PF
    if (sub.includes('lci') || sub.includes('lca') || tick.includes('LCI') || tick.includes('LCA')) {
      return 'lci_lca';
    }
    return 'renda_fixa';
  }

  if (sub.includes('fii') || sub.includes('fundo imob') || tick.endsWith('11') && (tick.includes('HGLG') || tick.includes('MXRF') || tick.includes('XPML') || tick.includes('VISC') || tick.includes('BRCO'))) {
    return 'fii';
  }

  if (sub.includes('etf') || tick.endsWith('11') && !sub.includes('ação') && !sub.includes('dividend')) {
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
 * Ponto de entrada principal.
 *
 * @param assetType       tipo tributário do ativo
 * @param sellValue       valor total recebido na venda (R$)
 * @param costBasis       custo médio proporcional (R$) — calculado pelo TransactionModal
 * @param sellDate        data da venda (YYYY-MM-DD)
 * @param assetCreatedAt  data de criação/compra (ISO) para renda fixa
 * @param monthlySalesOfSameType  total já vendido no mesmo mês neste tipo (para limite R$ 20k em ações)
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

  // Link genérico para o Sicalc da Receita Federal
  const darfUrl = `https://sicalc.receita.fazenda.gov.br/sicalc/rapido/contribuinte`;

  let isExempt = false;
  let exemptReason: string | undefined;
  let taxRate = 0;
  let taxDue = 0;
  const explanation: string[] = [];

  if (isLoss) {
    explanation.push(`❌ Esta venda resultou em um PREJUÍZO de R$ ${Math.abs(profitLoss).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
    explanation.push(`💡 Você não deve pagar IR quando há prejuízo.`);
    explanation.push(`📋 Porém, é obrigatório declarar a venda no IRPF (aba "Renda Variável" da declaração).`);
    explanation.push(`🔄 O prejuízo pode ser usado para compensar lucros em vendas futuras do mesmo tipo de ativo — mantenha o controle neste histórico!`);

    return {
      assetType, assetTypeLabel, sellValue, costBasis, profitLoss, isLoss,
      isExempt: true, exemptReason: 'Venda com prejuízo',
      taxRate: 0, taxDue: 0, darfPeriod, darfUrl, explanation,
    };
  }

  // ── AÇÕES ────────────────────────────────────────────────────────────────────
  if (assetType === 'acao') {
    const totalMonthSales = monthlySalesOfSameType + sellValue;
    taxRate = 0.15;

    if (totalMonthSales <= 20000) {
      isExempt = true;
      exemptReason = `Total de vendas de ações no mês (R$ ${totalMonthSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) está dentro do limite de isenção de R$ 20.000,00`;
      taxDue = 0;
      explanation.push(`✅ ISENTO — Suas vendas de ações em ${monthYear} somam R$ ${totalMonthSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, abaixo do teto de R$ 20.000 mensais.`);
      explanation.push(`📌 Base legal: Art. 3º, § 2º, da Lei 11.033/2004.`);
      explanation.push(`📋 Mesmo isento, declare a venda no IRPF (aba "Renda Variável").`);
    } else {
      isExempt = false;
      taxDue = profitLoss * taxRate;
      explanation.push(`💸 Lucro realizado: R$ ${profitLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      explanation.push(`⚠️ Suas vendas de ações em ${monthYear} somam R$ ${totalMonthSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, acima do limite de isenção de R$ 20.000.`);
      explanation.push(`📌 Alíquota aplicável: 15% sobre o lucro (art. 2º da Lei 11.033/2004).`);
      explanation.push(`🧾 IR devido: R$ ${taxDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      explanation.push(`📅 Vencimento do DARF: último dia útil do mês seguinte (${nextMonthDue(darfPeriod)}).`);
      explanation.push(`🔗 Código do DARF para ações: 6015.`);
    }
  }

  // ── ETF ──────────────────────────────────────────────────────────────────────
  else if (assetType === 'etf') {
    taxRate = 0.15;
    taxDue = profitLoss * taxRate;
    explanation.push(`💸 Lucro realizado: R$ ${profitLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    explanation.push(`⚠️ ETFs de renda variável NÃO têm isenção por limite de vendas mensais.`);
    explanation.push(`📌 Alíquota: 15% sobre o lucro (IN RFB 1.585/2015).`);
    explanation.push(`🧾 IR devido: R$ ${taxDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    explanation.push(`📅 Vencimento do DARF: último dia útil do mês seguinte (${nextMonthDue(darfPeriod)}).`);
    explanation.push(`🔗 Código do DARF para ETFs: 6015.`);
  }

  // ── FII ──────────────────────────────────────────────────────────────────────
  else if (assetType === 'fii') {
    taxRate = 0.20;
    taxDue = profitLoss * taxRate;
    explanation.push(`💸 Lucro realizado: R$ ${profitLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    explanation.push(`⚠️ FIIs tributam o ganho de capital à alíquota de 20%, sem isenção.`);
    explanation.push(`📌 Base legal: Art. 2º da Lei 8.668/93 e art. 3º da Lei 11.033/2004.`);
    explanation.push(`🧾 IR devido: R$ ${taxDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    explanation.push(`📅 Vencimento do DARF: último dia útil do mês seguinte (${nextMonthDue(darfPeriod)}).`);
    explanation.push(`🔗 Código do DARF para FIIs: 6015.`);
  }

  // ── LCI / LCA ────────────────────────────────────────────────────────────────
  else if (assetType === 'lci_lca') {
    isExempt = true;
    exemptReason = 'LCI e LCA são isentos de IR para Pessoa Física';
    taxRate = 0;
    taxDue = 0;
    explanation.push(`✅ ISENTO — LCI e LCA são completamente isentos de IR para Pessoa Física.`);
    explanation.push(`📌 Base legal: Art. 3º, inciso IV, da Lei 11.033/2004.`);
    explanation.push(`📋 Não há necessidade de emitir DARF. Informe o rendimento no IRPF (aba "Rendimentos Isentos e Não Tributáveis").`);
  }

  // ── RENDA FIXA ───────────────────────────────────────────────────────────────
  else if (assetType === 'renda_fixa') {
    const days = assetCreatedAt ? daysBetween(assetCreatedAt, sellDate) : 721;
    taxRate = rendaFixaAliquota(days);
    taxDue = profitLoss * taxRate;
    const taxRatePct = (taxRate * 100).toFixed(1);

    explanation.push(`💸 Rendimento obtido: R$ ${profitLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    explanation.push(`📅 Prazo estimado de aplicação: ${days} dias.`);
    explanation.push(`📌 Alíquota da tabela regressiva (${days} dias): ${taxRatePct}%.`);
    explanation.push(`  • Até 180 dias: 22,5%  |  181–360 dias: 20%  |  361–720 dias: 17,5%  |  > 720 dias: 15%`);
    explanation.push(`🧾 IR estimado sobre o rendimento: R$ ${taxDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    explanation.push(`✅ Para CDB, LCI tributável, Tesouro Direto e similares, o IR é retido automaticamente na fonte pelo banco ou corretora no momento do resgate. Você não precisa emitir DARF.`);
    explanation.push(`📋 Informe o rendimento no IRPF (aba "Rendimentos Sujeitos à Tributação Exclusiva/Definitiva") usando o informe de rendimentos da instituição financeira.`);
  }

  return {
    assetType, assetTypeLabel, sellValue, costBasis, profitLoss, isLoss,
    isExempt, exemptReason, taxRate, taxDue, darfPeriod, darfUrl, explanation,
  };
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
