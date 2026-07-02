import { describe, it, expect } from 'vitest';
import {
  calculatePortfolio,
  calculateGoalProjection,
  autoDetectMonthlyReturn,
  autoDetectMonthlyContribution,
  formatCurrency,
  formatPercent,
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
