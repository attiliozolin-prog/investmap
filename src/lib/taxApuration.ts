/**
 * taxApuration.ts — Apuração MENSAL do IR sobre vendas de investimentos.
 *
 * Por que existe: o `calculateTax` (taxCalculator.ts) calcula o IR de UMA
 * venda no momento em que ela é registrada, e o resultado fica gravado no
 * registro. Isso tem três problemas que a lei não admite:
 *
 *   1. A isenção de R$ 20 mil (ações) / R$ 35 mil (cripto) depende do total
 *      vendido NO MÊS — uma venda lançada depois muda a situação das
 *      anteriores, mas o registro antigo ficava congelado como "isento".
 *   2. Prejuízos acumulados abatem o lucro dos meses seguintes — o app
 *      mostrava o saldo, mas nunca o descontava do IR.
 *   3. O DARF é mensal (um por código), não um por venda, e abaixo de
 *      R$ 10 não se recolhe: o valor acumula para o mês seguinte.
 *
 * Este módulo NÃO altera os registros de venda. Eles são tratados como
 * fatos (data, valor, custo, tipo) e a apuração é sempre recalculada do
 * zero a partir deles, em ordem cronológica. Assim não importa em que
 * ordem as vendas foram lançadas, nem se uma foi excluída ou editada.
 *
 * Regras (ver também o cabeçalho de taxCalculator.ts):
 * - Grupo "bolsa" (ações, ETFs de renda variável, BDRs) — 15%, DARF 6015.
 *   Ações: se o total VENDIDO em ações no mês ≤ R$ 20.000, o lucro líquido
 *   de ações do mês é isento; prejuízo líquido de ações continua
 *   compensável. ETFs e BDRs não têm isenção.
 * - Grupo "fii" — 20%, DARF 6015; prejuízo só compensa lucro de FII.
 * - Grupo "cripto" (exchange nacional) — isento se vendas no mês
 *   ≤ R$ 35.000; acima, alíquota progressiva sobre a soma dos ganhos do
 *   mês, DARF 4600. Prejuízo não compensa (apuração definitiva).
 * - Renda fixa, ETF de renda fixa e LCI/LCA ficam fora do DARF (retidos
 *   na fonte ou isentos).
 * - Venda com custo desconhecido (custo ≤ 0 num tipo apurável) fica FORA
 *   do resultado — calcular com custo zero geraria IR sobre o valor
 *   inteiro da venda. O valor vendido continua contando para o teto de
 *   isenção, e o mês é sinalizado como incompleto.
 */

import type { AssetType, SellTaxRecord } from '@/types';
import { cryptoAliquota } from './taxCalculator';

export type DarfCode = '6015' | '4600';
export type ApurationGroup = 'bolsa' | 'fii' | 'cripto';

/** Pagamento de DARF registrado pelo usuário (um mês × um código). */
export interface DarfPayment {
  id: string;
  period: string;      // competência YYYY-MM
  darfCode: DarfCode;
  amount: number;
  paidAt: string;      // YYYY-MM-DD
  createdAt: string;
}

export const ACOES_EXEMPTION_LIMIT = 20_000;
export const CRYPTO_EXEMPTION_LIMIT = 35_000;
export const DARF_MINIMUM = 10;

const GROUP_OF: Partial<Record<AssetType, ApurationGroup>> = {
  acao: 'bolsa', etf: 'bolsa', bdr: 'bolsa', fii: 'fii', crypto: 'cripto',
};

export const DARF_CODE_OF_GROUP: Record<ApurationGroup, DarfCode> = {
  bolsa: '6015', fii: '6015', cripto: '4600',
};

const GROUP_RATE: Record<'bolsa' | 'fii', number> = { bolsa: 0.15, fii: 0.20 };

export function groupOf(type: AssetType): ApurationGroup | null {
  return GROUP_OF[type] ?? null;
}

/** Venda de tipo apurável cujo custo de aquisição não é conhecido. */
export function isCostPending(r: Pick<SellTaxRecord, 'assetType' | 'costBasis'>): boolean {
  return groupOf(r.assetType) !== null && !(r.costBasis > 0);
}

export type SaleStatus =
  | 'custo_pendente'
  | 'prejuizo'
  | 'isento'
  | 'tributavel'
  | 'retido_fonte'
  | 'sem_resultado';

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  custo_pendente: 'Custo pendente',
  prejuizo: 'Prejuízo',
  isento: 'Isento',
  tributavel: 'Tributável',
  retido_fonte: 'Retido na fonte',
  sem_resultado: 'Sem lucro',
};

export interface GroupApuration {
  group: ApurationGroup;
  /** Total vendido no mês (inclui vendas com custo pendente) */
  salesVolume: number;
  /** Resultado líquido das vendas com custo conhecido */
  result: number;
  /** Lucro que ficou isento neste mês */
  exemptProfit: number;
  /** Resultado sujeito a IR antes da compensação (negativo = prejuízo) */
  taxableResult: number;
  lossCarryIn: number;
  lossUsed: number;
  lossCarryOut: number;
  base: number;
  rate: number;
  tax: number;
}

export type DarfStatus = 'sem_ir' | 'abaixo_minimo' | 'pendente' | 'atrasado' | 'pago' | 'pago_a_mais';

export interface DarfApuration {
  period: string;
  code: DarfCode;
  /** Último dia útil do mês seguinte à competência (YYYY-MM-DD) */
  dueDate: string;
  /** IR apurado no mês para este código */
  tax: number;
  /** IR de meses anteriores que ficou abaixo do mínimo e acumulou */
  carryIn: number;
  /** tax + carryIn */
  total: number;
  paid: number;
  /** Quanto ainda falta pagar (0 quando pago ou abaixo do mínimo) */
  open: number;
  status: DarfStatus;
  /** Já havia pagamento e o valor apurado cresceu — DARF complementar */
  complementar: boolean;
  /** Há venda com custo pendente neste mês/código — valor provisório */
  incomplete: boolean;
}

export interface MonthApuration {
  period: string;
  groups: Record<ApurationGroup, GroupApuration>;
  darfs: DarfApuration[];
  acoesSales: number;
  acoesExempt: boolean;
  criptoSales: number;
  criptoExempt: boolean;
  pendingCostCount: number;
  /** Lucro de renda fixa / ETF de RF (IR retido na fonte pelo banco) */
  withheldProfit: number;
  /** Lucro isento de LCI/LCA */
  lciLcaProfit: number;
}

export interface TaxApuration {
  months: MonthApuration[];
  /** Todos os DARFs com algum valor apurado ou pago, em ordem cronológica */
  darfs: DarfApuration[];
  saleStatus: Record<string, SaleStatus>;
  /** Prejuízo acumulado disponível ao fim da série */
  lossCarry: { bolsa: number; fii: number };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const EPS = 0.005;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Vencimento do DARF: último dia útil do mês seguinte à competência.
 * Feriados nacionais não são modelados (podem antecipar o vencimento em
 * um dia útil em raros meses) — o vencimento real deve ser conferido no Sicalc.
 */
export function darfDueDate(period: string): string {
  const [y, m] = period.split('-').map(Number);
  // Dia 0 do mês m+2 (índice 0-based) = último dia do mês m+1
  const d = new Date(Date.UTC(y, m + 1, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function emptyGroup(group: ApurationGroup): GroupApuration {
  return {
    group, salesVolume: 0, result: 0, exemptProfit: 0, taxableResult: 0,
    lossCarryIn: 0, lossUsed: 0, lossCarryOut: 0, base: 0, rate: 0, tax: 0,
  };
}

/** Aplica o prejuízo acumulado ao resultado tributável do mês. */
function compensate(g: GroupApuration, carryIn: number): number {
  g.lossCarryIn = carryIn;
  if (g.taxableResult > 0) {
    g.lossUsed = Math.min(g.taxableResult, carryIn);
    g.base = g.taxableResult - g.lossUsed;
    g.lossCarryOut = carryIn - g.lossUsed;
  } else {
    g.base = 0;
    g.lossCarryOut = carryIn - g.taxableResult; // taxableResult ≤ 0
  }
  return g.lossCarryOut;
}

export function apurarIR(
  records: SellTaxRecord[],
  payments: DarfPayment[] = [],
  today: string = todayIso(),
): TaxApuration {
  const byPeriod = new Map<string, SellTaxRecord[]>();
  for (const r of records) {
    const p = r.sellDate.slice(0, 7);
    if (!byPeriod.has(p)) byPeriod.set(p, []);
    byPeriod.get(p)!.push(r);
  }
  for (const pay of payments) if (!byPeriod.has(pay.period)) byPeriod.set(pay.period, []);

  const periods = Array.from(byPeriod.keys()).sort();
  const saleStatus: Record<string, SaleStatus> = {};
  const months: MonthApuration[] = [];
  const darfs: DarfApuration[] = [];

  let lossBolsa = 0;
  let lossFii = 0;
  const belowMinCarry: Record<DarfCode, number> = { '6015': 0, '4600': 0 };

  for (const period of periods) {
    const recs = byPeriod.get(period)!;
    const groups: Record<ApurationGroup, GroupApuration> = {
      bolsa: emptyGroup('bolsa'), fii: emptyGroup('fii'), cripto: emptyGroup('cripto'),
    };

    let acoesSales = 0;
    let acoesNet = 0;
    let bolsaOthersNet = 0;
    let criptoSales = 0;
    let criptoGains = 0;
    let pendingCostCount = 0;
    let withheldProfit = 0;
    let lciLcaProfit = 0;
    const pendingByCode: Record<DarfCode, boolean> = { '6015': false, '4600': false };

    for (const r of recs) {
      const group = groupOf(r.assetType);
      if (r.assetType === 'acao') acoesSales += r.sellValue;
      if (r.assetType === 'crypto') criptoSales += r.sellValue;
      if (group) groups[group].salesVolume += r.sellValue;

      if (isCostPending(r)) {
        pendingCostCount++;
        pendingByCode[DARF_CODE_OF_GROUP[group!]] = true;
        continue;
      }

      const profit = r.sellValue - r.costBasis;
      if (group) groups[group].result += profit;

      if (r.assetType === 'acao') acoesNet += profit;
      else if (r.assetType === 'etf' || r.assetType === 'bdr') bolsaOthersNet += profit;
      else if (r.assetType === 'fii') groups.fii.taxableResult += profit;
      else if (r.assetType === 'crypto') { if (profit > 0) criptoGains += profit; }
      else if (r.assetType === 'lci_lca') { if (profit > 0) lciLcaProfit += profit; }
      else if (profit > 0) withheldProfit += profit; // renda_fixa, etf_rf
    }

    const acoesExempt = acoesSales <= ACOES_EXEMPTION_LIMIT;
    const criptoExempt = criptoSales <= CRYPTO_EXEMPTION_LIMIT;

    // ── Bolsa comum ──
    const bolsa = groups.bolsa;
    let acoesTaxable = acoesNet;
    if (acoesExempt && acoesNet > 0) {
      bolsa.exemptProfit = acoesNet;
      acoesTaxable = 0;
    }
    bolsa.taxableResult = acoesTaxable + bolsaOthersNet;
    lossBolsa = compensate(bolsa, lossBolsa);
    bolsa.rate = GROUP_RATE.bolsa;
    bolsa.tax = round2(bolsa.base * bolsa.rate);

    // ── FII ──
    const fii = groups.fii;
    lossFii = compensate(fii, lossFii);
    fii.rate = GROUP_RATE.fii;
    fii.tax = round2(fii.base * fii.rate);

    // ── Cripto (sem compensação entre meses) ──
    const cripto = groups.cripto;
    if (criptoExempt) {
      cripto.exemptProfit = criptoGains;
    } else {
      cripto.taxableResult = criptoGains;
      cripto.base = criptoGains;
      cripto.rate = criptoGains > 0 ? cryptoAliquota(criptoGains) : 0;
      cripto.tax = round2(cripto.base * cripto.rate);
    }

    // ── Status de cada venda ──
    for (const r of recs) {
      let st: SaleStatus;
      const profit = r.sellValue - r.costBasis;
      if (isCostPending(r)) st = 'custo_pendente';
      else if (profit < 0) st = 'prejuizo';
      else if (r.assetType === 'lci_lca') st = 'isento';
      else if (r.assetType === 'renda_fixa' || r.assetType === 'etf_rf') st = profit > 0 ? 'retido_fonte' : 'sem_resultado';
      else if (profit === 0) st = 'sem_resultado';
      else if (r.assetType === 'acao' && acoesExempt) st = 'isento';
      else if (r.assetType === 'crypto' && criptoExempt) st = 'isento';
      else st = 'tributavel';
      saleStatus[r.id] = st;
    }

    // ── DARFs do mês ──
    const monthDarfs: DarfApuration[] = [];
    const taxByCode: Record<DarfCode, number> = {
      '6015': round2(bolsa.tax + fii.tax),
      '4600': cripto.tax,
    };
    for (const code of ['6015', '4600'] as DarfCode[]) {
      const tax = taxByCode[code];
      const carryIn = round2(belowMinCarry[code]);
      const total = round2(tax + carryIn);

      const rowsPaid = payments
        .filter(p => p.period === period && p.darfCode === code)
        .reduce((s, p) => s + p.amount, 0);
      // Pagamentos marcados no modelo antigo (um "DARF" por venda)
      const legacyPaid = recs
        .filter(r => {
          const g = groupOf(r.assetType);
          return g !== null && DARF_CODE_OF_GROUP[g] === code && r.taxPaid && r.taxDue > 0;
        })
        .reduce((s, r) => s + r.taxDue, 0);
      const paid = round2(rowsPaid + legacyPaid);

      if (total < EPS && paid < EPS) {
        belowMinCarry[code] = 0;
        continue;
      }

      const dueDate = darfDueDate(period);
      let status: DarfStatus;
      let open = 0;
      if (paid < EPS && total < DARF_MINIMUM) {
        status = 'abaixo_minimo';
        belowMinCarry[code] = total;
      } else {
        belowMinCarry[code] = 0;
        open = round2(Math.max(0, total - paid));
        if (open < 0.01) status = paid > total + 0.01 ? 'pago_a_mais' : 'pago';
        else status = today > dueDate ? 'atrasado' : 'pendente';
      }

      const darf: DarfApuration = {
        period, code, dueDate, tax, carryIn, total, paid, open, status,
        complementar: open >= 0.01 && paid >= EPS,
        incomplete: pendingByCode[code],
      };
      monthDarfs.push(darf);
      darfs.push(darf);
    }

    months.push({
      period, groups, darfs: monthDarfs,
      acoesSales, acoesExempt, criptoSales, criptoExempt,
      pendingCostCount, withheldProfit, lciLcaProfit,
    });
  }

  return {
    months,
    darfs,
    saleStatus,
    lossCarry: { bolsa: round2(lossBolsa), fii: round2(lossFii) },
  };
}

/** Rótulo curto de competência: "2026-03" → "Mar/2026" */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[Number(m) - 1]}/${y}`;
}
