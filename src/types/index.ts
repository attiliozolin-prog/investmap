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
  isArchived: boolean;
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

export interface FinanceCategory {
  id: string;
  name: string;
}

export type FinanceTransactionType = 'income' | 'expense';

// Seção na planilha a que pertence este lançamento
export type FinanceSection = 'boleto' | 'assinatura' | 'extra' | 'income';

// Status de pagamento do lançamento
export type FinancePaymentStatus = 'pending' | 'paid' | 'auto_debit' | 'scheduled' | 'overdue';

// Pessoa física ou jurídica
export type FinanceCpfCnpj = 'CPF' | 'CNPJ';

export interface FinanceTransaction {
  id: string;
  monthId: string;            // Referência ao FinanceMonth
  type: FinanceTransactionType;
  section: FinanceSection;    // Boleto / Assinatura / Extra / Receita
  description: string;
  value: number;
  date: string;               // ISO Date YYYY-MM-DD
  createdAt: string;

  // Campos específicos de Boletos
  dueDay?: number;            // Dia de vencimento (1-31)
  category?: string;          // Ex: Sobrevivência, Telefonia, Saúde, Impostos...
  cpfCnpj?: FinanceCpfCnpj;  // CPF ou CNPJ
  paymentStatus?: FinancePaymentStatus;
  notes?: string;             // Observações livres

  // Campo de assinaturas
  card?: string;              // Cartão onde é debitado
}

// Computed finance interfaces
export interface FinanceMonthSummary {
  monthId: string;
  totalIncome: number;
  totalExpenseBoleto: number;
  totalExpenseSubscription: number;
  totalExpenseExtra: number;
  totalExpense: number;
  balance: number;
}

// ============================================
// Types — Tax / IR
// ============================================

// Tipo de ativo para fins tributários
export type AssetType = 'acao' | 'etf' | 'fii' | 'lci_lca' | 'renda_fixa';

export interface SellTaxRecord {
  id: string;
  userId?: string;
  assetId: string;
  assetTicker: string;
  sellValue: number;
  costBasis: number;
  profitLoss: number;
  assetType: AssetType;
  taxRate: number;       // 0.0–1.0
  taxDue: number;
  isExempt: boolean;
  exemptReason?: string;
  isLoss: boolean;
  lossUsedForCompensation: number;
  taxPaid: boolean;
  taxPaidAt?: string;
  darfPeriod?: string;   // YYYY-MM
  notes?: string;
  sellDate: string;      // YYYY-MM-DD
  createdAt: string;
}

// Resultado do cálculo de IR para exibição
export interface TaxCalculation {
  assetType: AssetType;
  assetTypeLabel: string;
  sellValue: number;
  costBasis: number;
  profitLoss: number;
  isLoss: boolean;
  isExempt: boolean;
  exemptReason?: string;
  taxRate: number;
  taxDue: number;
  darfPeriod: string;
  darfUrl: string;
  explanation: string[];
}
