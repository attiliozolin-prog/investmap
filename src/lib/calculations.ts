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

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatPercentAbs(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

// ============================================
// Portfolio Calculations
// ============================================

export function calculatePortfolio(
  strategy: Strategy,
  assets: Asset[],
): PortfolioSummary {
  const totalCurrent = assets.reduce((sum, a) => sum + a.currentValue, 0);
  const totalInvested = assets.reduce((sum, a) => sum + a.investedValue, 0);
  const totalProfitLoss = totalCurrent - totalInvested;
  const totalProfitLossPercent =
    totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  const assetsWithCalcs: AssetWithCalcs[] = assets
    .map((asset) => {
      const category = strategy.categories.find(
        (c) => c.id === asset.categoryId,
      );
      // Ativo sem categoria válida: ignorar silenciosamente (dados legados no localStorage)
      if (!category) return null;

      const profitLoss = asset.currentValue - asset.investedValue;
      const profitLossPercent =
        asset.investedValue > 0
          ? (profitLoss / asset.investedValue) * 100
          : 0;
      const currentPortfolioPercent =
        totalCurrent > 0 ? (asset.currentValue / totalCurrent) * 100 : 0;
      const targetPercent = category.targetPercent;
      const diffPercent = targetPercent - currentPortfolioPercent;

      const targetValue = (totalCurrent * targetPercent) / 100;
      const rebalanceAmount = targetValue - asset.currentValue;

      let action: 'buy' | 'sell' | 'ok' = 'ok';
      const absDiff = Math.abs(diffPercent);
      if (absDiff > strategy.deviationTolerance) {
        action = diffPercent > 0 ? 'buy' : 'sell';
      }

      return {
        ...asset,
        category,
        profitLoss,
        profitLossPercent,
        currentPortfolioPercent,
        targetPercent,
        diffPercent,
        rebalanceAmount,
        action,
      };
    })
    .filter((a): a is AssetWithCalcs => a !== null);


  // Group by category
  const categorySummaries: CategorySummary[] = strategy.categories.map((cat) => {
    const catAssets = assetsWithCalcs.filter(
      (a) => a.categoryId === cat.id,
    );
    const currentValue = catAssets.reduce((s, a) => s + a.currentValue, 0);
    const currentPercent =
      totalCurrent > 0 ? (currentValue / totalCurrent) * 100 : 0;
    const targetValue = (totalCurrent * cat.targetPercent) / 100;
    const rebalanceAmount = targetValue - currentValue;
    const diffPercent = cat.targetPercent - currentPercent;
    const absDiff = Math.abs(diffPercent);
    let action: 'buy' | 'sell' | 'ok' = 'ok';
    if (absDiff > strategy.deviationTolerance) {
      action = diffPercent > 0 ? 'buy' : 'sell';
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

  // Health Score: 100 - average absolute deviation from targets
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

  const needsRebalancing = assetsWithCalcs.some((a) => a.action !== 'ok');

  return {
    totalInvested,
    totalCurrent,
    totalProfitLoss,
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
