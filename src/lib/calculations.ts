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
  const totalInvested = assets.reduce((sum, a) => sum + a.investedValue, 0);
  const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);

  const profitLoss = totalValue - totalInvested;
  const totalProfitLossPercent =
    totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

  const assetsWithCalcs: AssetWithCalcs[] = assets
    .map((asset) => {
      let category = strategy.categories.find(
        (c) => c.id === asset.categoryId,
      );
      
      // Ativo sem categoria válida (ex: categoria deletada, ou onboarding alterado)
      if (!category) {
        category = {
          id: asset.categoryId, // manter o id para grouping, mas mostrar como órfão
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
      const currentPortfolioPercent =
        totalValue > 0 ? (asset.currentValue / totalValue) * 100 : 0;
      const targetPercent = category.targetPercent;
      const siblingCount = assets.filter(a => a.categoryId === asset.categoryId).length;
      const assetTargetPercent = siblingCount > 0 ? targetPercent / siblingCount : targetPercent;
      
      const diffPercent = currentPortfolioPercent - assetTargetPercent;

      const targetValue = (totalValue * assetTargetPercent) / 100;
      const rebalanceAmount = targetValue - asset.currentValue;

      let action: 'buy' | 'sell' | 'ok' = 'ok';
      const absDiff = Math.abs(diffPercent);
      if (absDiff > strategy.deviationTolerance) {
        action = diffPercent > 0 ? 'sell' : 'buy';
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
