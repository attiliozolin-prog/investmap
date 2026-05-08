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
