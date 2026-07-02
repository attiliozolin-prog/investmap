/**
 * taxCalculator.ts — Motor de Cálculo de IR em Investimentos (Brasil, jul/2026)
 *
 * Regras aplicadas (revisadas contra a legislação vigente em julho de 2026;
 * a MP 1.303/2025 caducou em out/2025 e a Lei 15.270/2025 não alterou o
 * ganho de capital tratado aqui):
 * - Ações (B3): 15% sobre lucro; isenção se total de vendas no mês ≤ R$ 20.000
 * - BDR: 15% sobre lucro, SEM isenção de R$ 20k (isenção do art. 3º da
 *   Lei 11.033/2004 vale apenas para ações)
 * - ETF de Renda Variável: 15% sobre lucro, sem isenção de R$ 20k
 * - ETF de Renda Fixa: tabela própria (25%/20%/15% pelo prazo médio da
 *   carteira do fundo), IR retido na fonte — sem DARF (IN RFB 1.585/2015)
 * - FII (Fundos de Investimento Imobiliário): 20% sobre lucro, sem isenção
 * - LCI / LCA: Isento para Pessoa Física
 * - Renda Fixa (CDB, Tesouro Direto, etc): Tabela regressiva de 22,5% → 15%
 * - Crypto (regime nacional/GCAP): isenção se total de vendas no mês
 *   ≤ R$ 35.000; acima disso, alíquota progressiva de 15% a 22,5% sobre o
 *   lucro. Prejuízo NÃO é compensável entre meses neste regime.
 *
 * Compensação de prejuízos:
 * - Ações / ETFs / BDRs (operações comuns em bolsa): compensável entre si
 * - FII: compensável apenas com lucros futuros em FIIs
 * - Cripto (regime nacional), Renda Fixa, LCI/LCA: NÃO compensável
 *
 * Limitações conhecidas (documentadas na página Impostos):
 * - Day trade (20%, apuração separada) não é diferenciado
 * - Regime exterior (Lei 14.754/2023: apuração anual, 15%) não é coberto
 * - Isenções de R$ 20k/35k consideram apenas as vendas registradas no app
 *
 * Referências:
 * - Lei 11.033/2004, art. 3º (isenção ações) e art. 2º (alíquota 15%)
 * - Lei 8.668/93 (FII, ganho de capital a 20%)
 * - Lei 8.981/95, art. 21 (ganho de capital — tabela progressiva usada p/ cripto)
 * - IN RFB 1.888/2019 (criptoativos — obrigações e isenção de R$ 35 mil)
 * - IN RFB 1.585/2015 (ETFs; ETF de renda fixa retido na fonte)
 * - Lei 14.754/2023 (regime de aplicações no exterior — fora do escopo)
 */

import { AssetType, TaxCalculation } from '@/types';

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  acao:       'Ação (B3)',
  bdr:        'BDR (Recibo de Ação Estrangeira)',
  etf:        'ETF de Renda Variável',
  etf_rf:     'ETF de Renda Fixa',
  fii:        'Fundo de Investimento Imobiliário (FII)',
  lci_lca:    'LCI / LCA',
  renda_fixa: 'Renda Fixa (CDB / Tesouro / etc)',
  crypto:     'Criptoativo',
};

// ETFs de renda fixa conhecidos na B3 (tributação própria, retido na fonte)
const ETF_RF_TICKERS = [
  'IMAB11', 'IMBB11', 'B5P211', 'IB5M11', 'IRFM11', 'LFTS11',
  'NTNS11', 'FIXA11', 'DEBB11', 'B5MB11', 'BNDX11', 'TESD11',
];

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

  // ── ETF de Renda Fixa (antes de renda fixa genérica e de ETF de RV) ──────
  if (ETF_RF_TICKERS.includes(tick) || (sub.includes('etf') && (sub.includes('renda fixa') || sub.includes('tesouro') || sub.includes('imab') || sub.includes('selic')))) {
    return 'etf_rf';
  }

  // ── Renda Fixa ────────────────────────────────────────────────────────────
  if (cls.includes('renda fixa') || sub.includes('renda fixa') || sub.includes('tesouro') || sub.includes('cdb') || sub.includes('lc')) {
    if (sub.includes('lci') || sub.includes('lca') || tick.includes('LCI') || tick.includes('LCA')) {
      return 'lci_lca';
    }
    return 'renda_fixa';
  }

  // ── BDR — 4 letras + dois dígitos iniciados em 3 (31/32/33/34/35/39) ─────
  // Ações B3 terminam em 1 dígito (PETR4); units/FIIs/ETFs em 11.
  if (/^[A-Z]{4}3[1-9]$/.test(tick) || sub.includes('bdr')) {
    return 'bdr';
  }

  // ── FII ───────────────────────────────────────────────────────────────────
  if (
    sub.includes('fii') || sub.includes('fundo imob') ||
    (tick.endsWith('11') && ['HGLG','MXRF','XPML','VISC','BRCO','KNRI','HGRU'].some(f => tick.startsWith(f)))
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
    explanation.push(`❌ Esta venda resultou em um PREJUÍZO de R$ ${fmt(Math.abs(profitLoss))}.`);
    explanation.push(`💡 Você não deve pagar IR quando há prejuízo.`);
    explanation.push(`📋 É obrigatório declarar a venda no IRPF.`);

    // A compensação de prejuízos depende do regime tributário de cada tipo
    if (assetType === 'acao' || assetType === 'etf' || assetType === 'bdr') {
      explanation.push(`🔄 O prejuízo pode ser compensado com lucros futuros em operações comuns de renda variável na bolsa (ações, ETFs, BDRs) — mantenha o controle neste histórico!`);
    } else if (assetType === 'fii') {
      explanation.push(`🔄 O prejuízo pode ser compensado APENAS com lucros futuros em vendas de FIIs (a compensação de FII é separada das demais ações/ETFs).`);
    } else if (assetType === 'crypto') {
      explanation.push(`⚠️ ATENÇÃO: no regime nacional (exchange brasileira), prejuízo com criptoativos NÃO pode ser compensado com lucros de outros meses — a apuração é mensal e definitiva (GCAP).`);
      explanation.push(`🌍 Exceção: criptoativos em exchange no exterior seguem a Lei 14.754/2023 (apuração anual, 15%), onde a compensação no ano é permitida — regime não coberto por este app.`);
    } else {
      explanation.push(`ℹ️ Para este tipo de ativo não há mecanismo de compensação de prejuízo no IRPF.`);
    }

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

  // ── BDR ──────────────────────────────────────────────────────────────────
  else if (assetType === 'bdr') {
    taxRate = 0.15;
    taxDue = profitLoss * taxRate;
    explanation.push(`💸 Lucro realizado: R$ ${fmt(profitLoss)}`);
    explanation.push(`⚠️ BDRs NÃO têm a isenção de R$ 20.000 mensais — ela vale apenas para ações (art. 3º da Lei 11.033/2004). Todo lucro em BDR é tributado.`);
    explanation.push(`📌 Alíquota: 15% sobre o lucro em operações comuns.`);
    explanation.push(`🧾 IR devido: R$ ${fmt(taxDue)}`);
    explanation.push(`📅 Vencimento do DARF: ${nextMonthDue(darfPeriod)}.`);
    explanation.push(`🔗 Código do DARF: 6015.`);
  }

  // ── ETF de Renda Fixa ────────────────────────────────────────────────────
  else if (assetType === 'etf_rf') {
    taxRate = 0;
    taxDue = 0;
    explanation.push(`💸 Rendimento obtido: R$ ${fmt(profitLoss)}`);
    explanation.push(`📌 ETFs de renda fixa têm tabela própria pelo PRAZO MÉDIO da carteira do fundo (não pelo seu tempo de posse): até 180 dias: 25% | 181–720: 20% | acima de 720: 15%.`);
    explanation.push(`✅ O IR é RETIDO NA FONTE na venda (IN RFB 1.585/2015) — você não precisa emitir DARF.`);
    explanation.push(`ℹ️ A maioria dos ETFs de renda fixa da B3 (IMAB11, B5P211, etc.) tem prazo médio longo, caindo na alíquota de 15%.`);
    explanation.push(`📋 Informe o rendimento no IRPF (aba "Rendimentos Sujeitos à Tributação Exclusiva/Definitiva").`);
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
      explanation.push(`📌 Base legal: IN RFB 1.888/2019 (isenção p/ vendas mensais ≤ R$ 35 mil no regime nacional).`);
      explanation.push(`⚠️ O teto considera TODAS as suas vendas de cripto no mês, em qualquer exchange nacional — inclusive troca de uma cripto por outra.`);
      explanation.push(`📋 Mesmo isento, declare a venda no IRPF (ficha "Bens e Direitos" + rendimentos isentos).`);
    } else {
      // Tributável: alíquota progressiva sobre o lucro
      taxRate = cryptoAliquota(profitLoss);
      taxDue = profitLoss * taxRate;
      const taxRatePct = (taxRate * 100).toFixed(1);

      explanation.push(`💸 Lucro realizado: R$ ${fmt(profitLoss)}`);
      explanation.push(`⚠️ Suas vendas de criptoativos em ${monthYear} somam R$ ${fmt(totalMonthSales)}, acima do limite de isenção de R$ 35.000.`);
      explanation.push(`📌 Alíquota progressiva de ganho de capital: ${taxRatePct}% (art. 21 da Lei 8.981/95; obrigações da IN RFB 1.888/2019).`);
      explanation.push(`  • Lucro ≤ R$ 5M: 15%  |  R$ 5M–10M: 17,5%  |  R$ 10M–30M: 20%  |  > R$ 30M: 22,5%`);
      explanation.push(`🧾 IR devido: R$ ${fmt(taxDue)}`);
      explanation.push(`📅 Vencimento do DARF: ${nextMonthDue(darfPeriod)}. Apure pelo programa GCAP da Receita.`);
      explanation.push(`🔗 Código do DARF para criptoativos: 4600.`);
      explanation.push(`🌍 Vendeu em exchange no exterior? Aí vale a Lei 14.754/2023 (apuração anual, 15%) — regime não coberto por este cálculo.`);
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
