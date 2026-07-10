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
  investedValue: number;       // Custo total de aquisição (qty × avgPrice, ou manual)
  currentValue: number;        // Valor atual na cotação (qty × customPrice, ou manual)
  quantity?: number;           // Quantidade de cotas/ações (opcional)
  avgPrice?: number;           // Preço Médio de Aquisição — PME (custo histórico por ação)
  customPrice?: number;        // Preço de mercado atual (para botão "Auto" e cálculo de currentValue)
  priceMode?: 'auto' | 'manual'; // 'auto' = Brapi sincroniza; 'manual' = usuário insere
  isArchived?: boolean;        // Ativo encerrado — excluído da carteira ativa, preservado no histórico
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

// Seção na planilha a que pertence este lançamento.
// 'cartao' = compra dentro da fatura do cartão (importada da fatura ou manual).
//   Como as assinaturas, NÃO soma nas saídas do mês — o dinheiro sai uma vez
//   só, pela fatura (lançamento 'boleto' da categoria Cartão Crédito). Serve
//   para análise por categoria do que compõe a fatura.
// 'assinatura' é um valor LEGADO: assinaturas deixaram de ser lançamentos
// mensais e viraram FinanceSubscription (global, fora do mês) — mantido no
// tipo apenas para não quebrar a leitura de linhas antigas já no banco.
export type FinanceSection = 'boleto' | 'assinatura' | 'extra' | 'income' | 'cartao';

// Status de pagamento do lançamento
// 'previsto' = valor estimado (ex.: fatura do cartão pela média dos últimos
// meses) que ainda precisa ser confirmado quando o valor real for conhecido
export type FinancePaymentStatus = 'pending' | 'paid' | 'auto_debit' | 'scheduled' | 'previsto' | 'overdue';

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

// Assinatura recorrente cobrada na fatura do cartão. Vive FORA do mês —
// diferente de FinanceTransaction, não pertence a nenhum FinanceMonth e por
// isso "persiste" automaticamente todo mês até o usuário adicionar/remover.
export interface FinanceSubscription {
  id: string;
  description: string;
  category?: string;
  value: number;
  createdAt: string;
}

// ── Importação de lançamentos via IA (foto ou PDF de fatura/extrato) ──

export type AiImportDocumentType = 'fatura_cartao' | 'extrato' | 'cupom' | 'recibo' | 'boleto' | 'outro';

// Item extraído do documento pela IA — sempre revisado pelo usuário antes
// de virar FinanceTransaction (a IA sugere, o usuário confirma).
export interface AiImportItem {
  description: string;
  value: number;
  date: string | null;      // YYYY-MM-DD, null se o documento não mostra
  category: string | null;  // exatamente uma das categorias do usuário, ou null
  type: FinanceTransactionType;
}

export interface AiImportResult {
  documentType: AiImportDocumentType;
  referenceMonth: string | null;  // YYYY-MM
  totalDetected: number | null;   // total do documento (ex.: total da fatura)
  items: AiImportItem[];
  truncated?: boolean;            // documento tinha mais itens que o limite
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
export type AssetType = 'acao' | 'etf' | 'etf_rf' | 'bdr' | 'fii' | 'lci_lca' | 'renda_fixa' | 'crypto';

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

// ============================================
// Types — Financial Goals
// ============================================

export interface FinancialGoal {
  id: string;
  strategyId: string;
  title: string;
  emoji: string;
  targetValue: number;             // Valor da meta em BRL
  monthlyContribution?: number;    // Aporte mensal (undefined = auto-detectado)
  monthlyReturnRate?: number;      // Rendimento mensal % (undefined = auto-detectado)
  isAchieved: boolean;
  achievedAt?: string;             // ISO Date quando alcançou a meta
  createdAt: string;
  updatedAt: string;
}

// Resultado do cálculo de projeção de meta
export interface GoalProjectionResult {
  monthsToGoal: number;
  yearsToGoal: number;
  monthsFraction: number;          // meses restantes após os anos inteiros
  progressPercent: number;         // % do valor atual em relação à meta
  projectionData: Array<{ month: number; value: number }>; // Para mini-gráfico
  scenarios: {
    baseCase: { months: number; years: number; monthsFraction: number };
    increasedContribution: { months: number; years: number; monthsFraction: number; extraAmount: number };
    increasedReturn: { months: number; years: number; monthsFraction: number; extraRate: number };
  };
  autoDetected: {
    monthlyContribution: number;
    annualReturnRate: number;
  };
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
