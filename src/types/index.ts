// ============================================
// Types — InvestMap
// ============================================

export type AssetClass = 'Renda Fixa' | 'Renda Variável' | string;

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  deviationTolerance: number; // % máximo de desvio antes de alertar
  categories: StrategyCategory[];
  createdAt: string;
  updatedAt: string;
}

export interface StrategyCategory {
  id: string;
  strategyId: string;
  className: AssetClass;       // Ex: "Renda Fixa"
  subclassName: string;        // Ex: "ETF - S&P EUA"
  targetPercent: number;       // 0-100
}

export interface Asset {
  id: string;
  strategyId: string;
  categoryId: string;
  ticker: string;              // Ex: "IVVB11"
  info: string;                // Ex: "BlackRock"
  investedValue: number;       // Valor aplicado
  currentValue: number;        // Valor atual
  updatedAt: string;
}

// Computed / derived types

export interface AssetWithCalcs extends Asset {
  category: StrategyCategory;
  profitLoss: number;
  profitLossPercent: number;
  currentPortfolioPercent: number;
  targetPercent: number;
  diffPercent: number;
  rebalanceAmount: number;    // positivo = comprar, negativo = vender
  action: 'buy' | 'sell' | 'ok';
}

export interface CategorySummary {
  category: StrategyCategory;
  targetPercent: number;
  currentPercent: number;
  currentValue: number;
  rebalanceAmount: number;
  action: 'buy' | 'sell' | 'ok';
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrent: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  healthScore: number;         // 0-100, quão próximo da estratégia
  assetsWithCalcs: AssetWithCalcs[];
  categorySummaries: CategorySummary[];
  needsRebalancing: boolean;
}
