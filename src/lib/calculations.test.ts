import { describe, it, expect } from 'vitest';
import {
  calculatePortfolio,
  calculateGoalProjection,
  autoDetectMonthlyReturn,
  autoDetectMonthlyContribution,
  formatCurrency,
  formatPercent,
  deviationBand,
  idealContributionPlan,
  calculateXIRR,
  estimateMonthlyVolatility,
} from './calculations';
import { Strategy, Asset, FinancialGoal, PortfolioSnapshot } from '@/types';

// ── Fixtures ────────────────────────────────────────────────────────────────

const strategy: Strategy = {
  id: 's1',
  name: 'Teste',
  deviationTolerance: 5,
  categories: [
    { id: 'c1', strategyId: 's1', className: 'Renda Fixa', subclassName: 'Tesouro', targetPercent: 50 },
    { id: 'c2', strategyId: 's1', className: 'Renda Variável', subclassName: 'Ações BR', targetPercent: 50 },
  ],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const asset = (over: Partial<Asset>): Asset => ({
  id: 'a1',
  strategyId: 's1',
  categoryId: 'c1',
  ticker: 'TESTE',
  info: '',
  investedValue: 1000,
  currentValue: 1000,
  updatedAt: '2026-01-01',
  ...over,
});

// ── calculatePortfolio ──────────────────────────────────────────────────────

describe('calculatePortfolio — totais', () => {
  it('soma investido, valor atual e lucro corretamente', () => {
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', investedValue: 5000, currentValue: 5500 }),
      asset({ id: 'a2', categoryId: 'c2', investedValue: 5000, currentValue: 4500 }),
    ]);
    expect(p.totalInvested).toBe(10000);
    expect(p.totalValue).toBe(10000);
    expect(p.profitLoss).toBe(0);
    expect(p.totalProfitLossPercent).toBe(0);
  });

  it('carteira vazia não divide por zero', () => {
    const p = calculatePortfolio(strategy, []);
    expect(p.totalValue).toBe(0);
    expect(p.totalProfitLossPercent).toBe(0);
    expect(Number.isNaN(p.healthScore)).toBe(false);
  });

  it('ativos encerrados (archived) ficam fora dos totais e do % de carteira', () => {
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', investedValue: 5000, currentValue: 5000 }),
      asset({ id: 'a2', categoryId: 'c2', investedValue: 9999, currentValue: 9999, isArchived: true }),
    ]);
    expect(p.totalValue).toBe(5000);
    const archived = p.assetsWithCalcs.find(a => a.id === 'a2')!;
    expect(archived.currentPortfolioPercent).toBe(0);
    expect(archived.rebalanceAmount).toBe(0);
    expect(archived.action).toBe('ok');
  });

  it('ativo com categoria inexistente vira "Não Categorizado" sem quebrar', () => {
    const p = calculatePortfolio(strategy, [asset({ categoryId: 'nao-existe' })]);
    expect(p.assetsWithCalcs[0].category.className).toBe('Não Categorizado');
  });
});

describe('calculatePortfolio — rebalanceamento', () => {
  it('carteira perfeitamente alinhada → healthScore 100 e nada a rebalancear', () => {
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', currentValue: 5000 }),
      asset({ id: 'a2', categoryId: 'c2', currentValue: 5000 }),
    ]);
    expect(p.healthScore).toBe(100);
    expect(p.needsRebalancing).toBe(false);
    expect(p.assetsWithCalcs.every(a => a.action === 'ok')).toBe(true);
  });

  it('desvio acima da tolerância marca buy/sell', () => {
    // c1 com 80% (alvo 50), c2 com 20% (alvo 50), tolerância 5
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', currentValue: 8000 }),
      asset({ id: 'a2', categoryId: 'c2', currentValue: 2000 }),
    ]);
    const a1 = p.assetsWithCalcs.find(a => a.id === 'a1')!;
    const a2 = p.assetsWithCalcs.find(a => a.id === 'a2')!;
    expect(a1.action).toBe('sell');
    expect(a2.action).toBe('buy');
    expect(p.needsRebalancing).toBe(true);
    // rebalanceAmount leva cada um ao alvo de 50% (5000)
    expect(a1.rebalanceAmount).toBeCloseTo(-3000, 2);
    expect(a2.rebalanceAmount).toBeCloseTo(3000, 2);
  });

  it('meta individual divide o alvo da subclasse entre os ativos irmãos', () => {
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', currentValue: 2500 }),
      asset({ id: 'a2', categoryId: 'c1', currentValue: 2500 }),
      asset({ id: 'a3', categoryId: 'c2', currentValue: 5000 }),
    ]);
    const a1 = p.assetsWithCalcs.find(a => a.id === 'a1')!;
    expect(a1.assetTargetPercent).toBe(25); // 50% / 2 irmãos
  });

  it('healthScore cai com o desvio médio', () => {
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', currentValue: 8000 }),
      asset({ id: 'a2', categoryId: 'c2', currentValue: 2000 }),
    ]);
    // desvio médio = (30 + 30) / 2 = 30 → score = 100 - 60 = 40
    expect(p.healthScore).toBe(40);
  });
});

// ── Banda 5/25 ──────────────────────────────────────────────────────────────

describe('deviationBand (regra 5/25)', () => {
  it('alvos grandes usam a tolerância absoluta', () => {
    expect(deviationBand(3, 40)).toBe(3);   // 25% de 40 = 10 > 3
    expect(deviationBand(5, 50)).toBe(5);
  });

  it('alvos pequenos usam 25% relativos (com piso de 1 p.p.)', () => {
    expect(deviationBand(3, 4)).toBe(1);    // 25% de 4 = 1
    expect(deviationBand(3, 8)).toBe(2);    // 25% de 8 = 2
    expect(deviationBand(3, 2)).toBe(1);    // 25% de 2 = 0.5 → piso 1
  });

  it('subclasse pequena fora da banda relativa dispara mesmo dentro da tolerância absoluta', () => {
    const strat: Strategy = {
      ...strategy,
      deviationTolerance: 5,
      categories: [
        { id: 'c1', strategyId: 's1', className: 'RF', subclassName: 'Tesouro', targetPercent: 92 },
        { id: 'c2', strategyId: 's1', className: 'RV', subclassName: 'Cripto', targetPercent: 8 },
      ],
    };
    // Cripto com 12% (alvo 8): desvio 4 < tolerância 5, mas > 25% do alvo (2)
    const p = calculatePortfolio(strat, [
      asset({ id: 'a1', categoryId: 'c1', currentValue: 8800 }),
      asset({ id: 'a2', categoryId: 'c2', currentValue: 1200 }),
    ]);
    const cripto = p.categorySummaries.find(cs => cs.category.id === 'c2')!;
    expect(cripto.action).toBe('sell');
  });
});

// ── Gate de sinais por subclasse ────────────────────────────────────────────

describe('sinais por ativo respeitam a subclasse', () => {
  it('subclasse na meta → ativos internos desiguais não geram falso buy/sell', () => {
    // c1 na meta (50%), mas dividida 70/30 entre dois ativos
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', currentValue: 3500 }),
      asset({ id: 'a2', categoryId: 'c1', currentValue: 1500 }),
      asset({ id: 'a3', categoryId: 'c2', currentValue: 5000 }),
    ]);
    expect(p.assetsWithCalcs.every(a => a.action === 'ok')).toBe(true);
    expect(p.needsRebalancing).toBe(false);
  });

  it('targetWeight rateia o alvo da subclasse por peso', () => {
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', currentValue: 3500, targetWeight: 7 }),
      asset({ id: 'a2', categoryId: 'c1', currentValue: 1500, targetWeight: 3 }),
      asset({ id: 'a3', categoryId: 'c2', currentValue: 5000 }),
    ]);
    const a1 = p.assetsWithCalcs.find(a => a.id === 'a1')!;
    expect(a1.assetTargetPercent).toBeCloseTo(35, 5); // 50% × 0.7
  });
});

// ── Plano de aporte (waterfall) ─────────────────────────────────────────────

describe('idealContributionPlan', () => {
  it('sem budget: menor aporte que zera todos os desvios sem vender', () => {
    // c1 80% / c2 20%, alvos 50/50 → T' = 8000/0.5 = 16000 → aportar 6000 em c2
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', currentValue: 8000 }),
      asset({ id: 'a2', categoryId: 'c2', currentValue: 2000 }),
    ]);
    const plan = idealContributionPlan(p.categorySummaries, p.totalValue)!;
    expect(plan.fullyBalances).toBe(true);
    expect(plan.total).toBeCloseTo(6000, 0);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].categoryId).toBe('c2');
    expect(plan.items[0].resultingPercent).toBeCloseTo(50, 1);
  });

  it('carteira na meta → null', () => {
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', currentValue: 5000 }),
      asset({ id: 'a2', categoryId: 'c2', currentValue: 5000 }),
    ]);
    expect(idealContributionPlan(p.categorySummaries, p.totalValue)).toBeNull();
  });

  it('com budget insuficiente: prioriza a subclasse mais defasada (water-filling)', () => {
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', currentValue: 8000 }),
      asset({ id: 'a2', categoryId: 'c2', currentValue: 2000 }),
    ]);
    const plan = idealContributionPlan(p.categorySummaries, p.totalValue, 3000)!;
    expect(plan.fullyBalances).toBe(false);
    expect(plan.total).toBeCloseTo(3000, 0);
    // tudo vai para c2 (única defasada)
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].categoryId).toBe('c2');
    expect(plan.items[0].amount).toBeCloseTo(3000, 0);
  });

  it('com budget maior que os déficits: zera déficits e rateia a sobra pelos alvos', () => {
    const p = calculatePortfolio(strategy, [
      asset({ id: 'a1', categoryId: 'c1', currentValue: 5200 }),
      asset({ id: 'a2', categoryId: 'c2', currentValue: 4800 }),
    ]);
    const plan = idealContributionPlan(p.categorySummaries, p.totalValue, 2000)!;
    expect(plan.fullyBalances).toBe(true);
    expect(plan.total).toBeCloseTo(2000, 0);
    const soma = plan.items.reduce((s, i) => s + i.amount, 0);
    expect(soma).toBeCloseTo(2000, 0);
    // resultado final: ambas em 50%
    plan.items.forEach(i => expect(i.resultingPercent).toBeCloseTo(50, 0));
  });
});

// ── XIRR ────────────────────────────────────────────────────────────────────

describe('calculateXIRR', () => {
  it('retorno anual de um único aporte que dobra em 1 ano ≈ 100%', () => {
    const r = calculateXIRR([
      { date: '2025-01-01', value: -1000 },
      { date: '2026-01-01', value: 2000 },
    ])!;
    expect(r).toBeCloseTo(1.0, 1);
  });

  it('fluxos de um sinal só → null', () => {
    expect(calculateXIRR([
      { date: '2025-01-01', value: -1000 },
      { date: '2026-01-01', value: -500 },
    ])).toBeNull();
  });

  it('período curto demais (< 60 dias) → null', () => {
    expect(calculateXIRR([
      { date: '2026-01-01', value: -1000 },
      { date: '2026-01-15', value: 1100 },
    ])).toBeNull();
  });

  it('aportes mensais sem rendimento → taxa ~0', () => {
    const flows = [];
    for (let m = 0; m < 12; m++) {
      flows.push({ date: `2025-${String(m + 1).padStart(2, '0')}-01`, value: -100 });
    }
    flows.push({ date: '2026-01-01', value: 1200 });
    const r = calculateXIRR(flows)!;
    expect(Math.abs(r)).toBeLessThan(0.01);
  });
});

describe('estimateMonthlyVolatility', () => {
  it('poucos dados → default 2,5%', () => {
    expect(estimateMonthlyVolatility([], 's1')).toBe(0.025);
  });

  it('série estável tem volatilidade baixa', () => {
    const snaps: PortfolioSnapshot[] = ['01', '02', '03', '04', '05', '06'].map((m, i) => ({
      id: m, strategyId: 's1', date: `2026-${m}-28`,
      totalValue: 1000 * Math.pow(1.01, i), totalInvested: 1000, profitLoss: 0,
    }));
    expect(estimateMonthlyVolatility(snaps, 's1')).toBeLessThanOrEqual(0.01);
  });
});

// ── Incerteza Monte Carlo ───────────────────────────────────────────────────

describe('calculateGoalProjection — banda de incerteza', () => {
  it('com volatilidade, expõe banda p25/p75 em torno do cenário base', () => {
    const r = calculateGoalProjection(
      goal({ targetValue: 50000, monthlyContribution: 1000, monthlyReturnRate: 0.008 }),
      10000, 0, 0, 0.03,
    );
    expect(r.uncertainty).toBeDefined();
    expect(r.uncertainty!.optimisticMonths).toBeLessThanOrEqual(r.uncertainty!.pessimisticMonths);
    expect(r.uncertainty!.optimisticMonths).toBeGreaterThan(0);
  });

  it('sem volatilidade, não há banda', () => {
    const r = calculateGoalProjection(
      goal({ targetValue: 50000, monthlyContribution: 1000, monthlyReturnRate: 0.008 }),
      10000, 0, 0,
    );
    expect(r.uncertainty).toBeUndefined();
  });
});

// ── Metas ───────────────────────────────────────────────────────────────────

const goal = (over: Partial<FinancialGoal>): FinancialGoal => ({
  id: 'g1',
  strategyId: 's1',
  title: 'Meta',
  emoji: '🎯',
  targetValue: 12000,
  isAchieved: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...over,
});

describe('calculateGoalProjection', () => {
  it('meta já atingida → 0 meses e 100% de progresso', () => {
    const r = calculateGoalProjection(goal({ targetValue: 1000 }), 2000, 0, 0.01);
    expect(r.monthsToGoal).toBe(0);
    expect(r.progressPercent).toBe(100);
  });

  it('sem aporte e sem rendimento → nunca atinge (Infinity)', () => {
    const r = calculateGoalProjection(
      goal({ monthlyContribution: 0, monthlyReturnRate: 0 }),
      1000, 0, 0
    );
    expect(r.monthsToGoal).toBe(Infinity);
  });

  it('sem rendimento, aporte fixo: 12k com 1k/mês ≈ 12 meses', () => {
    const r = calculateGoalProjection(
      goal({ targetValue: 12000, monthlyContribution: 1000, monthlyReturnRate: 0 }),
      0, 0, 0
    );
    expect(r.monthsToGoal).toBe(12);
  });

  it('com rendimento positivo chega mais rápido que sem', () => {
    const sem = calculateGoalProjection(
      goal({ targetValue: 50000, monthlyContribution: 1000, monthlyReturnRate: 0 }),
      10000, 0, 0
    );
    const com = calculateGoalProjection(
      goal({ targetValue: 50000, monthlyContribution: 1000, monthlyReturnRate: 0.01 }),
      10000, 0, 0
    );
    expect(com.monthsToGoal).toBeLessThan(sem.monthsToGoal);
  });

  it('cenário com aporte maior é sempre ≤ cenário base', () => {
    const r = calculateGoalProjection(
      goal({ targetValue: 100000, monthlyContribution: 1000, monthlyReturnRate: 0.005 }),
      10000, 0, 0
    );
    expect(r.scenarios.increasedContribution.months).toBeLessThanOrEqual(r.scenarios.baseCase.months);
  });
});

describe('autoDetectMonthlyReturn', () => {
  it('menos de 2 snapshots → fallback 1% a.m.', () => {
    expect(autoDetectMonthlyReturn([], 's1')).toBe(0.01);
  });

  it('resultado fica limitado ao range -2% a 5% a.m.', () => {
    const snaps: PortfolioSnapshot[] = [
      { id: '1', strategyId: 's1', date: '2026-01-01', totalValue: 1000, totalInvested: 1000, profitLoss: 0 },
      { id: '2', strategyId: 's1', date: '2026-02-01', totalValue: 9000, totalInvested: 1000, profitLoss: 8000 },
    ];
    const r = autoDetectMonthlyReturn(snaps, 's1');
    expect(r).toBeLessThanOrEqual(0.05);
    expect(r).toBeGreaterThanOrEqual(-0.02);
  });
});

describe('autoDetectMonthlyContribution', () => {
  it('sem compras recentes → 0', () => {
    expect(autoDetectMonthlyContribution([], [])).toBe(0);
  });

  it('média mensal das compras dos últimos 6 meses', () => {
    const now = new Date();
    const iso = (monthsAgo: number) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - monthsAgo);
      return d.toISOString().slice(0, 10);
    };
    const txs = [
      { type: 'buy', value: 1000, date: iso(1) },
      { type: 'buy', value: 3000, date: iso(2) },
      { type: 'sell', value: 500, date: iso(1) }, // vendas não contam
    ];
    // 2 meses com compras: (1000 + 3000) / 2 = 2000
    expect(autoDetectMonthlyContribution(txs, [])).toBe(2000);
  });
});

// ── Formatação ──────────────────────────────────────────────────────────────

describe('formatadores', () => {
  it('formatCurrency lida com null/undefined', () => {
    expect(formatCurrency(null)).toContain('0,00');
    expect(formatCurrency(undefined)).toContain('0,00');
  });

  it('formatPercent adiciona sinal de + para positivos', () => {
    expect(formatPercent(5.5)).toBe('+5.50%');
    expect(formatPercent(-3.2)).toBe('-3.20%');
  });
});
