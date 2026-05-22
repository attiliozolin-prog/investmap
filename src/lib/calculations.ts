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
      
      // Irmãos ATIVOS na mesma subcategoria (encerrados excluídos)
      const siblingCount = activeAssets.filter(a => a.categoryId === asset.categoryId).length;
      
      let assetTargetPercent = 0;
      if (!isArchived) {
        assetTargetPercent = siblingCount > 0 ? targetPercent / siblingCount : targetPercent;
      }
      
      const diffPercent = currentPortfolioPercent - assetTargetPercent;

      // Encerrados: rebalancear = 0 (não há alvo nem ação)
      const targetValue      = isArchived ? 0 : (totalValue * assetTargetPercent) / 100;
      const rebalanceAmount  = isArchived ? 0 : (targetValue - asset.currentValue);

      let action: 'buy' | 'sell' | 'ok' = 'ok';
      if (!isArchived) {
        const absDiff = Math.abs(diffPercent);
        if (absDiff > strategy.deviationTolerance) {
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
    if (absDiff > strategy.deviationTolerance) {
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

  // Health Score
  const totalTargetPercent = strategy.categories.reduce(
    (s, c) => s + c.targetPercent,
    0,
  );
  const avgDeviation =
    totalTargetPercent > 0
      ? categorySummaries.reduce(
          (s, cs) => s + Math.abs(cs.category.targetPercent - cs.currentPercent),
          0,
        ) / strategy.categories.length
      : 0;
  const healthScore = Math.max(0, Math.min(100, 100 - avgDeviation * 2));

  const needsRebalancing = assetsWithCalcs.some((a) => !a.isArchived && a.action !== 'ok');

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
 * Auto-detecta o rendimento médio mensal da carteira a partir dos snapshots.
 * Usa CAGR: taxa = (V_final / V_inicial)^(1/n) - 1, desconsiderando aportes (aproximação).
 */
export function autoDetectMonthlyReturn(snapshots: PortfolioSnapshot[], strategyId: string): number {
  const sorted = [...snapshots]
    .filter(s => s.strategyId === strategyId && s.totalValue > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  
  if (sorted.length < 2) return 0.01; // fallback: 1% a.m. (~12,7% a.a.)
  
  // Usa primeiros e últimos 12 meses para suavizar volatilidade
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  const firstDate = new Date(first.date);
  const lastDate = new Date(last.date);
  const monthsDiff = 
    (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
    (lastDate.getMonth() - firstDate.getMonth());
  
  if (monthsDiff <= 0 || first.totalValue <= 0) return 0.01;
  
  // Fator de crescimento, ajustado parcialmente pelos aportes
  // Aproximação: considera que metade do crescimento vem de aportes
  const totalGrowthFactor = last.totalValue / first.totalValue;
  const monthlyRate = Math.pow(totalGrowthFactor, 1 / monthsDiff) - 1;
  
  // Limita a um range razoável (0% a 5% a.m.)
  return Math.max(0, Math.min(0.05, monthlyRate));
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

/**
 * Calcula a projeção completa para atingir uma meta financeira.
 */
export function calculateGoalProjection(
  goal: FinancialGoal,
  currentValue: number,
  autoMonthlyContribution: number,
  autoMonthlyReturn: number,
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
  
  return {
    monthsToGoal: baseMonths,
    yearsToGoal: base.years,
    monthsFraction: base.months,
    progressPercent,
    projectionData,
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
