import {
  Strategy,
  Asset,
  AssetWithCalcs,
  CategorySummary,
  PortfolioSummary,
} from '@/types';

// ============================================
// Formatting
// ============================================

export function formatCurrency(value: number | undefined | null): string {
  const safe = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(safe);
}

export function formatPercent(value: number | undefined | null, decimals = 2): string {
  const safe = Number(value) || 0;
  return `${safe >= 0 ? '+' : ''}${safe.toFixed(decimals)}%`;
}

export function formatPercentAbs(value: number | undefined | null, decimals = 2): string {
  const safe = Number(value) || 0;
  return `${safe.toFixed(decimals)}%`;
}

// ============================================
// Portfolio Calculations
// ============================================

/**
 * Banda de rebalanceamento "5/25" (Larry Swedroe): dispara no que for MENOR
 * entre a tolerância absoluta da estratégia e 25% relativos ao alvo.
 * Assim uma subclasse de 40% com tolerância 3 dispara a 3 p.p., mas uma de
 * 4% dispara a 1 p.p. — desvio proporcionalmente igual de grave.
 * O piso (min(1, tolerância)) evita alertas por ruído em alvos minúsculos.
 */
export function deviationBand(tolerance: number, targetPercent: number): number {
  const floor = Math.min(1, tolerance);
  if (targetPercent <= 0) return Math.max(floor, tolerance);
  return Math.min(tolerance, Math.max(floor, targetPercent * 0.25));
}

export function calculatePortfolio(
  strategy: Strategy,
  assets: Asset[],
): PortfolioSummary {
  // ── Separa ativos encerrados dos ativos ativos ──────────────────────────────
  // Ativos encerrados (archived) NÃO entram no patrimônio total nem nos % de carteira.
  // Normalmente o AppContext já filtra encerrados, mas mantemos a verificação como segurança.
  const isAssetArchived = (a: Asset) => a.isArchived ?? false;

  const activeAssets   = assets.filter(a => !isAssetArchived(a));

  // Totais calculados apenas sobre ativos ATIVOS
  const totalInvested = activeAssets.reduce((sum, a) => sum + a.investedValue, 0);
  const totalValue    = activeAssets.reduce((sum, a) => sum + a.currentValue,  0);

  const profitLoss = totalValue - totalInvested;
  const totalProfitLossPercent =
    totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

  // ── Cálculo por ativo ───────────────────────────────────────────────────────
  const assetsWithCalcs: AssetWithCalcs[] = assets
    .map((asset) => {
      const isArchived = isAssetArchived(asset);

      let category = strategy.categories.find(
        (c) => c.id === asset.categoryId,
      );
      
      // Ativo sem categoria válida
      if (!category) {
        category = {
          id: asset.categoryId,
          strategyId: strategy.id,
          className: 'Não Categorizado',
          subclassName: 'Sem Categoria Correspondente',
          targetPercent: 0,
        };
      }

      const profitLoss = asset.currentValue - asset.investedValue;
      const profitLossPercent =
        asset.investedValue > 0
          ? (profitLoss / asset.investedValue) * 100
          : 0;

      // % da carteira: encerrados não afetam o totalValue nem mostram % real
      const currentPortfolioPercent =
        isArchived ? 0 : (totalValue > 0 ? (asset.currentValue / totalValue) * 100 : 0);

      const targetPercent = category.targetPercent;
      
      // Irmãos ATIVOS na mesma subcategoria (encerrados excluídos).
      // O alvo da subclasse é rateado pelo peso relativo de cada ativo
      // (targetWeight, opcional) — sem pesos definidos, divisão igualitária.
      const siblings = activeAssets.filter(a => a.categoryId === asset.categoryId);
      const totalWeight = siblings.reduce((s, a) => s + (a.targetWeight ?? 1), 0);

      let assetTargetPercent = 0;
      if (!isArchived) {
        assetTargetPercent = siblings.length > 0 && totalWeight > 0
          ? targetPercent * ((asset.targetWeight ?? 1) / totalWeight)
          : targetPercent;
      }
      
      const diffPercent = currentPortfolioPercent - assetTargetPercent;

      // Encerrados: rebalancear = 0 (não há alvo nem ação)
      const targetValue      = isArchived ? 0 : (totalValue * assetTargetPercent) / 100;
      const rebalanceAmount  = isArchived ? 0 : (targetValue - asset.currentValue);

      let action: 'buy' | 'sell' | 'ok' = 'ok';
      if (!isArchived) {
        const absDiff = Math.abs(diffPercent);
        if (absDiff > deviationBand(strategy.deviationTolerance, assetTargetPercent)) {
          action = diffPercent > 0 ? 'sell' : 'buy';
        }
      }

      return {
        ...asset,
        category,
        profitLoss,
        profitLossPercent,
        currentPortfolioPercent,
        targetPercent,
        assetTargetPercent,
        diffPercent,
        rebalanceAmount,
        action,
        isArchived,
      };
    })
    .filter((a): a is AssetWithCalcs => a !== null);


  // ── Sumário por categoria (apenas ativos ATIVOS) ───────────────────────────
  const categorySummaries: CategorySummary[] = strategy.categories.map((cat) => {
    // Considera apenas ativos não-encerrados para o sumário de categoria
    const catAssets = assetsWithCalcs.filter(
      (a) => a.categoryId === cat.id && !a.isArchived,
    );
    const currentValue = catAssets.reduce((s, a) => s + a.currentValue, 0);
    const currentPercent =
      totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    const targetValue = (totalValue * cat.targetPercent) / 100;
    const rebalanceAmount = targetValue - currentValue;
    const diffPercent = currentPercent - cat.targetPercent;
    const absDiff = Math.abs(diffPercent);
    let action: 'buy' | 'sell' | 'ok' = 'ok';
    if (absDiff > deviationBand(strategy.deviationTolerance, cat.targetPercent)) {
      action = diffPercent > 0 ? 'sell' : 'buy';
    }

    return {
      category: cat,
      targetPercent: cat.targetPercent,
      currentPercent,
      currentValue,
      rebalanceAmount,
      action,
    };
  });

  // ── Gate dos sinais por subclasse ───────────────────────────────────────
  // Um ativo só recebe buy/sell se a SUBCLASSE dele também estiver fora da
  // banda. O rateio interno (alvo ÷ irmãos) é uma convenção, não uma meta do
  // usuário — sem este gate, dois ativos deliberadamente desiguais na mesma
  // subclasse gerariam falsos "comprar um / vender o outro" com a subclasse
  // perfeitamente na meta. Ativos sem categoria na estratégia mantêm o
  // sinal próprio (não há subclasse para arbitrar).
  const catActionById = new Map(categorySummaries.map(cs => [cs.category.id, cs.action]));
  for (const a of assetsWithCalcs) {
    const catAction = catActionById.get(a.categoryId);
    if (catAction === 'ok') a.action = 'ok';
  }

  // Health Score = 100 − Σ|desvio| das subclasses (= 100 − 2×active share).
  // O active share (Σ|atual−alvo|/2) é exatamente o % da carteira que está
  // "no lugar errado" — diferente da média, não dilui uma concentração
  // grande entre várias subclasses corretas.
  const totalAbsDeviation = categorySummaries.reduce(
    (s, cs) => s + Math.abs(cs.currentPercent - cs.targetPercent),
    0,
  );
  const healthScore = Math.max(0, Math.min(100, 100 - totalAbsDeviation));

  const needsRebalancing = categorySummaries.some((cs) => cs.action !== 'ok');

  return {
    totalInvested,
    totalValue,
    profitLoss,
    totalProfitLossPercent,
    healthScore,
    assetsWithCalcs,
    categorySummaries,
    needsRebalancing,
  };
}

export interface IdealContribution {
  categoryId: string;
  subclassName: string;
  className: string;
  amount: number;
}

/**
 * Aporte único (sem vender nada) que recoloca a subclasse mais defasada da
 * estratégia dentro da meta. Resolve X tal que X/(totalValue + X) = target%:
 * X = (target% * totalValue - valorAtual) / (1 - target%).
 * Fonte única usada tanto em Ativos quanto no Dashboard, para os dois nunca
 * divergirem.
 */
export function idealSingleContribution(
  categorySummaries: CategorySummary[],
  totalValue: number,
): IdealContribution | null {
  const withTarget = categorySummaries.filter((cs) => cs.targetPercent > 0);
  if (withTarget.length === 0) return null;

  const worst = [...withTarget].sort(
    (a, b) => (a.currentPercent - a.targetPercent) - (b.currentPercent - b.targetPercent),
  )[0];
  const dev = worst.currentPercent - worst.targetPercent;
  if (dev >= 0) return null;

  const target = Math.min(worst.targetPercent, 99) / 100;
  const amount = Math.max(0, (target * totalValue - worst.currentValue) / (1 - target));
  if (amount <= 0.01) return null;

  return {
    categoryId: worst.category.id,
    subclassName: worst.category.subclassName,
    className: worst.category.className,
    amount,
  };
}

export interface ContributionPlanItem {
  categoryId: string;
  className: string;
  subclassName: string;
  amount: number;
  /** % da subclasse depois do plano executado */
  resultingPercent: number;
  targetPercent: number;
}

export interface ContributionPlan {
  /** Total a aportar (soma dos itens) */
  total: number;
  /** Alocações por subclasse, da maior para a menor */
  items: ContributionPlanItem[];
  /** true = executando o plano, TODAS as subclasses voltam à meta sem vender */
  fullyBalances: boolean;
}

/**
 * Plano de aporte multi-categoria (cash-flow rebalancing / "waterfall").
 *
 * Sem `budget`: calcula o MENOR aporte total que recoloca todas as subclasses
 * na meta sem vender nada. O novo patrimônio T' é ditado pela subclasse mais
 * SOBREalocada (T' = max(valorAtual_i / alvo_i)); cada subclasse subalocada
 * recebe (alvo_i × T' − valorAtual_i).
 *
 * Com `budget` (ex.: aporte mensal do usuário): distribui exatamente o budget
 * minimizando o pior desvio remanescente — water-filling: enche primeiro o
 * "copo" mais vazio em pontos percentuais até equalizar os déficits (nível L
 * achado por busca binária). Sobrando dinheiro após zerar todos os déficits,
 * o excedente é rateado proporcionalmente aos alvos para não criar desvio novo.
 */
export function idealContributionPlan(
  categorySummaries: CategorySummary[],
  totalValue: number,
  budget?: number,
): ContributionPlan | null {
  const withTarget = categorySummaries.filter((cs) => cs.targetPercent > 0);
  if (withTarget.length === 0 || totalValue <= 0) return null;

  const buildItems = (amounts: Map<string, number>, newTotal: number): ContributionPlanItem[] =>
    withTarget
      .map((cs) => {
        const amount = amounts.get(cs.category.id) ?? 0;
        return {
          categoryId: cs.category.id,
          className: cs.category.className,
          subclassName: cs.category.subclassName,
          amount,
          resultingPercent: newTotal > 0 ? ((cs.currentValue + amount) / newTotal) * 100 : 0,
          targetPercent: cs.targetPercent,
        };
      })
      .filter((i) => i.amount > 0.01)
      .sort((a, b) => b.amount - a.amount);

  if (budget == null) {
    // Novo total mínimo em que nenhuma subclasse fica acima do alvo
    const newTotal = Math.max(
      totalValue,
      ...withTarget.map((cs) => cs.currentValue / (Math.min(cs.targetPercent, 99) / 100)),
    );
    const amounts = new Map<string, number>();
    withTarget.forEach((cs) => {
      amounts.set(cs.category.id, Math.max(0, (cs.targetPercent / 100) * newTotal - cs.currentValue));
    });
    const items = buildItems(amounts, newTotal);
    const total = items.reduce((s, i) => s + i.amount, 0);
    if (total <= 0.01) return null;
    return { total, items, fullyBalances: true };
  }

  if (budget <= 0) return null;
  const newTotal = totalValue + budget;

  // Déficit em R$ de cada subclasse quando o alvo é rebaixado de L p.p.
  const neededAt = (level: number) =>
    withTarget.reduce(
      (s, cs) => s + Math.max(0, ((cs.targetPercent - level) / 100) * newTotal - cs.currentValue),
      0,
    );

  const amounts = new Map<string, number>();
  if (neededAt(0) <= budget) {
    // Budget cobre todos os déficits — zera cada um e rateia a sobra por alvo
    let used = 0;
    withTarget.forEach((cs) => {
      const need = Math.max(0, (cs.targetPercent / 100) * newTotal - cs.currentValue);
      amounts.set(cs.category.id, need);
      used += need;
    });
    const leftover = budget - used;
    if (leftover > 0.01) {
      const sumTargets = withTarget.reduce((s, cs) => s + cs.targetPercent, 0);
      withTarget.forEach((cs) => {
        amounts.set(
          cs.category.id,
          (amounts.get(cs.category.id) ?? 0) + leftover * (cs.targetPercent / sumTargets),
        );
      });
    }
    return { total: budget, items: buildItems(amounts, newTotal), fullyBalances: true };
  }

  // Water-filling: busca binária do nível L (p.p.) que consome o budget exato
  let lo = 0, hi = 100;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (neededAt(mid) > budget) lo = mid; else hi = mid;
  }
  withTarget.forEach((cs) => {
    amounts.set(
      cs.category.id,
      Math.max(0, ((cs.targetPercent - hi) / 100) * newTotal - cs.currentValue),
    );
  });
  return { total: budget, items: buildItems(amounts, newTotal), fullyBalances: false };
}

// ============================================
// ID Generation
// ============================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ============================================
// Colors for chart
// ============================================

export const CHART_COLORS = [
  '#8B5CF6', // primary violet
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#3B82F6', // blue
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo
  '#84CC16', // lime
];

// ============================================
// Goal / Meta Calculations
// ============================================

import { FinancialGoal, GoalProjectionResult, PortfolioSnapshot } from '@/types';

/**
 * Calcula o valor futuro após n meses com juros compostos e aporte mensal.
 * FV = PV × (1+r)^n + PMT × [((1+r)^n − 1) / r]
 */
function futureValue(pv: number, monthlyRate: number, months: number, pmt: number): number {
  if (monthlyRate === 0) return pv + pmt * months;
  const factor = Math.pow(1 + monthlyRate, months);
  return pv * factor + pmt * ((factor - 1) / monthlyRate);
}

/**
 * Encontra o número de meses para atingir o targetValue usando busca binária.
 * Retorna Infinity se não for possível atingir (PMT + rendimento < 0).
 */
function monthsToReachGoal(pv: number, monthlyRate: number, pmt: number, target: number): number {
  if (pv >= target) return 0;
  // Sem aportes e sem rendimento, impossível
  if (monthlyRate <= 0 && pmt <= 0) return Infinity;
  
  // Busca binária entre 1 e 600 meses (50 anos)
  let lo = 0, hi = 600;
  for (let i = 0; i < 60; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (futureValue(pv, monthlyRate, mid, pmt) >= target) {
      hi = mid;
    } else {
      lo = mid;
    }
    if (hi - lo <= 1) break;
  }
  // Verifica se mesmo com 600 meses não chega
  if (futureValue(pv, monthlyRate, hi, pmt) < target) return Infinity;
  return hi;
}

/**
 * Decompoe meses em anos + meses restantes.
 */
function decomposeMonths(totalMonths: number): { years: number; months: number } {
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

/**
 * XIRR — taxa interna de retorno ANUAL de uma série de fluxos datados.
 * Convenção: aportes negativos, resgates/valor final positivos.
 * Newton-Raphson com fallback de bissecção; null quando os fluxos não
 * permitem cálculo confiável (poucos fluxos, um sinal só, período < 60 dias).
 */
export function calculateXIRR(flows: Array<{ date: string; value: number }>): number | null {
  const fs = flows
    .filter(f => Number.isFinite(f.value) && f.value !== 0 && !isNaN(new Date(f.date).getTime()))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (fs.length < 2) return null;
  const hasNeg = fs.some(f => f.value < 0);
  const hasPos = fs.some(f => f.value > 0);
  if (!hasNeg || !hasPos) return null;

  const t0 = new Date(fs[0].date).getTime();
  const years = fs.map(f => (new Date(f.date).getTime() - t0) / (365.25 * 86400000));
  if (years[years.length - 1] < 60 / 365.25) return null;

  const npv = (r: number) => fs.reduce((s, f, i) => s + f.value / Math.pow(1 + r, years[i]), 0);

  // Newton-Raphson
  let rate = 0.1;
  for (let i = 0; i < 50; i++) {
    const v = npv(rate);
    const dv = (npv(rate + 1e-6) - v) / 1e-6;
    if (Math.abs(dv) < 1e-12) break;
    const next = rate - v / dv;
    if (!Number.isFinite(next) || next <= -0.999) break;
    if (Math.abs(next - rate) < 1e-9) return next;
    rate = next;
  }
  if (Number.isFinite(rate) && rate > -0.999 && Math.abs(npv(rate)) < 1e-4 * Math.abs(fs[0].value)) {
    return rate;
  }

  // Bissecção como fallback
  let lo = -0.95, hi = 10;
  let fLo = npv(lo);
  if (fLo * npv(hi) > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-8) return mid;
    if (fLo * fMid < 0) { hi = mid; } else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
}

/**
 * Volatilidade mensal (desvio-padrão dos log-retornos mês a mês) estimada
 * dos snapshots. Aproximação: ignora aportes intra-mês (superestima um pouco
 * a vol de quem aporta muito — aceitável para banda de incerteza).
 * Retorna um default conservador (2,5% a.m.) com menos de 4 meses de dados.
 */
export function estimateMonthlyVolatility(snapshots: PortfolioSnapshot[], strategyId: string): number {
  const byMonth = new Map<string, number>();
  [...snapshots]
    .filter(s => s.strategyId === strategyId && s.totalValue > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(s => byMonth.set(s.date.slice(0, 7), s.totalValue)); // último valor de cada mês

  const values = Array.from(byMonth.values());
  if (values.length < 4) return 0.025;

  const rets: number[] = [];
  for (let i = 1; i < values.length; i++) rets.push(Math.log(values[i] / values[i - 1]));
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(variance);
  return Math.max(0.005, Math.min(0.15, sd));
}

/**
 * Auto-detecta o rendimento médio mensal da carteira.
 *
 * Com `transactions` + `currentValue`: usa XIRR (fluxos datados) — o número
 * correto quando há aportes ao longo do período. Sem eles (ou quando o XIRR
 * não converge), cai para a aproximação por snapshots:
 * taxa = (1 + lucro/investido)^(1/n) - 1.
 */
export function autoDetectMonthlyReturn(
  snapshots: PortfolioSnapshot[],
  strategyId: string,
  transactions?: Array<{ type: string; value: number; date: string }>,
  currentValue?: number,
): number {
  if (transactions && transactions.length > 0 && currentValue != null && currentValue > 0) {
    const flows = transactions
      .filter(t => (t.type === 'buy' || t.type === 'sell') && t.value > 0)
      .map(t => ({ date: t.date, value: t.type === 'buy' ? -t.value : t.value }));
    flows.push({ date: new Date().toISOString().slice(0, 10), value: currentValue });
    const annual = calculateXIRR(flows);
    if (annual != null) {
      const monthly = Math.pow(1 + annual, 1 / 12) - 1;
      return Math.max(-0.02, Math.min(0.05, monthly));
    }
  }
  return autoDetectMonthlyReturnFromSnapshots(snapshots, strategyId);
}

function autoDetectMonthlyReturnFromSnapshots(snapshots: PortfolioSnapshot[], strategyId: string): number {
  const sorted = [...snapshots]
    .filter(s => s.strategyId === strategyId && s.totalValue > 0 && s.totalInvested > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 2) return 0.01; // fallback: ~12,7% a.a.

  const last = sorted[sorted.length - 1];
  const first = sorted[0];

  const firstDate = new Date(first.date);
  const lastDate  = new Date(last.date);
  const monthsDiff =
    (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
    (lastDate.getMonth() - firstDate.getMonth());

  if (monthsDiff <= 0) return 0.01;

  // Rendimento real = profitLoss / totalInvested (descontando aportes)
  // Alinhado com o que o dashboard exibe como "rendimento %"
  const profitLoss    = last.profitLoss;
  const totalInvested = last.totalInvested;

  if (totalInvested <= 0) return 0.01;

  const totalReturn = profitLoss / totalInvested;

  // Converte para taxa mensal equivalente
  const monthlyRate = Math.pow(1 + totalReturn, 1 / monthsDiff) - 1;

  // Limita a um range razoável (-2% a 5% a.m.)
  return Math.max(-0.02, Math.min(0.05, monthlyRate));
}

/**
 * Auto-detecta o aporte médio mensal a partir das transações de compra.
 * Considera os últimos 6 meses de transações `buy`.
 */
export function autoDetectMonthlyContribution(
  transactions: Array<{ type: string; value: number; date: string }>,
  strategyAssetIds: string[]
): number {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  // Filtra compras dos últimos 6 meses, apenas ativos da estratégia
  const recentBuys = transactions.filter(t => {
    if (t.type !== 'buy') return false;
    const txDate = new Date(t.date);
    return txDate >= sixMonthsAgo && txDate <= now;
  });
  
  if (recentBuys.length === 0) return 0;
  
  // Agrupa por mês e calcula média
  const byMonth: Record<string, number> = {};
  recentBuys.forEach(t => {
    const monthKey = t.date.slice(0, 7); // YYYY-MM
    byMonth[monthKey] = (byMonth[monthKey] || 0) + t.value;
  });
  
  const monthTotals = Object.values(byMonth);
  if (monthTotals.length === 0) return 0;
  
  return monthTotals.reduce((s, v) => s + v, 0) / monthTotals.length;
}

// ── Monte Carlo: banda de incerteza da projeção ─────────────────────────────

/** PRNG determinístico (mulberry32) — mesma banda a cada render, sem flicker. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simula trajetórias com retorno mensal ~ N(μ, σ) e devolve os percentis
 * 25/75 dos meses até a meta. Traduz "7 anos" em "entre 6 e 9 anos".
 */
function monteCarloMonthsToGoal(
  pv: number, mu: number, sigma: number, pmt: number, target: number,
  sims = 300,
): { optimisticMonths: number; pessimisticMonths: number } | null {
  if (pv >= target || sigma <= 0) return null;
  const rand = mulberry32(42);
  const results: number[] = [];
  for (let s = 0; s < sims; s++) {
    let v = pv;
    let m = 0;
    while (v < target && m < 600) {
      // Box-Muller
      const u1 = Math.max(rand(), 1e-12);
      const u2 = rand();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = v * (1 + mu + sigma * z) + pmt;
      if (v < 0) v = 0;
      m++;
    }
    results.push(v >= target ? m : Infinity);
  }
  results.sort((a, b) => a - b);
  const optimistic = results[Math.floor(sims * 0.25)];
  const pessimistic = results[Math.floor(sims * 0.75)];
  if (!Number.isFinite(optimistic)) return null;
  return { optimisticMonths: optimistic, pessimisticMonths: pessimistic };
}

/**
 * Calcula a projeção completa para atingir uma meta financeira.
 * `monthlyVolatility` (opcional) habilita a banda de incerteza Monte Carlo.
 */
export function calculateGoalProjection(
  goal: FinancialGoal,
  currentValue: number,
  autoMonthlyContribution: number,
  autoMonthlyReturn: number,
  monthlyVolatility?: number,
): GoalProjectionResult {
  const pv = currentValue;
  const target = goal.targetValue;
  const pmt = goal.monthlyContribution ?? autoMonthlyContribution;
  const annualRate = goal.monthlyReturnRate != null
    ? goal.monthlyReturnRate * 12  // já é mensal, converte p/ anual
    : autoMonthlyReturn * 12;
  const monthlyRate = (goal.monthlyReturnRate ?? autoMonthlyReturn);
  
  const progressPercent = target > 0 ? Math.min(100, (pv / target) * 100) : 0;
  
  // Cenário base
  const baseMonths = monthsToReachGoal(pv, monthlyRate, pmt, target);
  const base = decomposeMonths(baseMonths);
  
  // Cenário 1: aumenta aporte em 20% (ou R$ 500, o que for maior)
  const extraContribution = Math.max(pmt * 0.20, 500);
  const increasedPmt = pmt + extraContribution;
  const inc1Months = monthsToReachGoal(pv, monthlyRate, increasedPmt, target);
  const inc1 = decomposeMonths(inc1Months);
  
  // Cenário 2: aumenta rendimento em 2 p.p. a.a.
  const extraRatePP = 2; // 2 pontos percentuais a.a.
  const increasedMonthlyRate = monthlyRate + (extraRatePP / 100 / 12);
  const inc2Months = monthsToReachGoal(pv, increasedMonthlyRate, pmt, target);
  const inc2 = decomposeMonths(inc2Months);
  
  // Curva de projeção (pontos mensais até a meta ou 360 meses)
  const maxMonths = Math.min(baseMonths === Infinity ? 360 : baseMonths + 12, 360);
  const step = Math.max(1, Math.floor(maxMonths / 48)); // máx 48 pontos
  const projectionData: Array<{ month: number; value: number }> = [];
  for (let m = 0; m <= maxMonths; m += step) {
    projectionData.push({ month: m, value: Math.round(futureValue(pv, monthlyRate, m, pmt)) });
  }
  
  // Banda de incerteza (Monte Carlo) — só quando há volatilidade estimada e
  // a meta é atingível no cenário determinístico
  const uncertainty =
    monthlyVolatility != null && monthlyVolatility > 0 && baseMonths !== Infinity && baseMonths > 1
      ? monteCarloMonthsToGoal(pv, monthlyRate, monthlyVolatility, pmt, target) ?? undefined
      : undefined;

  return {
    monthsToGoal: baseMonths,
    yearsToGoal: base.years,
    monthsFraction: base.months,
    progressPercent,
    projectionData,
    uncertainty,
    scenarios: {
      baseCase: { months: baseMonths, years: base.years, monthsFraction: base.months },
      increasedContribution: { months: inc1Months, years: inc1.years, monthsFraction: inc1.months, extraAmount: extraContribution },
      increasedReturn: { months: inc2Months, years: inc2.years, monthsFraction: inc2.months, extraRate: extraRatePP },
    },
    autoDetected: {
      monthlyContribution: autoMonthlyContribution,
      annualReturnRate: annualRate,
    },
  };
}
