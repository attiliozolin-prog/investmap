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
  investedValue: number;       // Valor aplicado atual (já abatendo vendas)
  currentValue: number;        // Valor atual na cotação
  createdAt?: string;          // ISO Date
  updatedAt: string;
}

export type TransactionType = 'buy' | 'sell';

export interface Transaction {
  id: string;
  assetId: string;
  type: TransactionType;
  date: string;                // ISO Date
  value: number;               // Valor financeiro da transação
  notes?: string;              // Observações (opcional)
}

// Tipo derivado com cálculos para exibição no histórico
export interface TransactionWithCalcs extends Transaction {
  runningInvested: number;     // Valor investido acumulado após esta transação
  realizedProfit?: number;     // Lucro/prejuízo realizado nesta venda (apenas type='sell')
  index: number;               // Posição cronológica (1 = mais antiga)
}

export interface PortfolioSnapshot {
  id: string;
  strategyId: string;
  date: string;                // ISO Date focado no dia "YYYY-MM-DD"
  totalValue: number;          // Valor total atual
  totalInvested: number;       // Total investido
  profitLoss: number;          // Lucro/prejuízo absoluto
}

// Computed / derived types

export interface AssetWithCalcs extends Asset {
  category: StrategyCategory;
  profitLoss: number;
  profitLossPercent: number;
  currentPortfolioPercent: number;
  targetPercent: number;      // Meta da subclasse
  assetTargetPercent: number; // Meta individual (Subclasse / Qtd Ativos)
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
  totalValue: number;
  profitLoss: number;
  totalProfitLossPercent: number;
  healthScore: number;         // 0-100, quão próximo da estratégia
  assetsWithCalcs: AssetWithCalcs[];
  categorySummaries: CategorySummary[];
  needsRebalancing: boolean;
}

// ============================================
// Types — Finances
// ============================================

export type FinanceMonthStatus = 'open' | 'closed';

export interface FinanceMonth {
  id: string;
  month: string;      // Formato YYYY-MM
  status: FinanceMonthStatus;
  createdAt: string;
  updatedAt: string;
}

export type FinanceTransactionType = 'income' | 'expense';
export type FinanceTransactionCategory = 'Fixo' | 'Variável' | 'Assinatura';

export interface FinanceTransaction {
  id: string;
  monthId: string;    // Referência ao FinanceMonth
  type: FinanceTransactionType;
  category: FinanceTransactionCategory;
  description: string;
  value: number;
  date: string;       // ISO Date YYYY-MM-DD
  createdAt: string;
}

// Computed finance interfaces
export interface FinanceMonthSummary {
  monthId: string;
  totalIncome: number;
  totalExpenseFixed: number;
  totalExpenseVariable: number;
  totalExpenseSubscription: number;
  totalExpense: number;
  balance: number; // leftover
}
