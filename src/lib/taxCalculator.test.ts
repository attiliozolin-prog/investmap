import { describe, it, expect } from 'vitest';
import { calculateTax, detectAssetType } from './taxCalculator';

describe('detectAssetType', () => {
  it('detecta crypto pela classe', () => {
    expect(detectAssetType('Criptoativos', 'Bitcoin', 'BTC')).toBe('crypto');
  });

  it('detecta crypto pelo ticker conhecido', () => {
    expect(detectAssetType('Renda Variável', 'Outros', 'ETH')).toBe('crypto');
    expect(detectAssetType('Renda Variável', 'Outros', 'SOL')).toBe('crypto');
  });

  it('detecta LCI/LCA dentro de renda fixa', () => {
    expect(detectAssetType('Renda Fixa', 'LCI Banco X', 'LCI-BX')).toBe('lci_lca');
    expect(detectAssetType('Renda Fixa', 'LCA Agro', 'LCA-Y')).toBe('lci_lca');
  });

  it('detecta renda fixa (CDB, Tesouro)', () => {
    expect(detectAssetType('Renda Fixa', 'Tesouro Selic', 'SELIC29')).toBe('renda_fixa');
    expect(detectAssetType('Renda Fixa', 'CDB Banco Y', 'CDB-Y')).toBe('renda_fixa');
  });

  it('detecta FII pelo subclass e por tickers conhecidos', () => {
    expect(detectAssetType('Renda Variável', 'FIIs', 'HGLG11')).toBe('fii');
    expect(detectAssetType('Renda Variável', 'Fundos', 'MXRF11')).toBe('fii');
  });

  it('detecta ETF pelo subclass', () => {
    expect(detectAssetType('Renda Variável', 'ETF - S&P 500', 'IVVB11')).toBe('etf');
  });

  it('default é ação', () => {
    expect(detectAssetType('Renda Variável', 'Ações Brasil', 'PETR4')).toBe('acao');
  });
});

describe('calculateTax — prejuízo', () => {
  it('venda com prejuízo nunca gera imposto, em qualquer tipo', () => {
    for (const type of ['acao', 'etf', 'fii', 'crypto', 'renda_fixa'] as const) {
      const r = calculateTax(type, 5000, 8000, '2026-06-15');
      expect(r.isLoss).toBe(true);
      expect(r.taxDue).toBe(0);
      expect(r.isExempt).toBe(true);
      expect(r.profitLoss).toBe(-3000);
    }
  });
});

describe('calculateTax — ações', () => {
  it('isenta quando vendas do mês ≤ R$ 20.000 (limite exato)', () => {
    const r = calculateTax('acao', 20000, 15000, '2026-06-15');
    expect(r.isExempt).toBe(true);
    expect(r.taxDue).toBe(0);
  });

  it('tributa 15% quando vendas do mês ultrapassam R$ 20.000', () => {
    const r = calculateTax('acao', 20000.01, 15000, '2026-06-15');
    expect(r.isExempt).toBe(false);
    expect(r.taxRate).toBe(0.15);
    expect(r.taxDue).toBeCloseTo((20000.01 - 15000) * 0.15, 2);
  });

  it('soma vendas anteriores do mês para o teto de isenção', () => {
    // venda de 5k, mas já havia 18k vendidos no mês → total 23k, tributa
    const r = calculateTax('acao', 5000, 3000, '2026-06-15', undefined, 18000);
    expect(r.isExempt).toBe(false);
    expect(r.taxDue).toBeCloseTo(2000 * 0.15, 2);
  });

  it('darfPeriod é o mês da venda', () => {
    const r = calculateTax('acao', 30000, 10000, '2026-06-15');
    expect(r.darfPeriod).toBe('2026-06');
  });
});

describe('calculateTax — ETF', () => {
  it('tributa 15% sem isenção mesmo em venda pequena', () => {
    const r = calculateTax('etf', 1000, 800, '2026-06-15');
    expect(r.isExempt).toBe(false);
    expect(r.taxRate).toBe(0.15);
    expect(r.taxDue).toBeCloseTo(200 * 0.15, 2);
  });
});

describe('calculateTax — FII', () => {
  it('tributa 20% sem isenção', () => {
    const r = calculateTax('fii', 10000, 8000, '2026-06-15');
    expect(r.isExempt).toBe(false);
    expect(r.taxRate).toBe(0.20);
    expect(r.taxDue).toBeCloseTo(2000 * 0.20, 2);
  });
});

describe('calculateTax — LCI/LCA', () => {
  it('sempre isento para PF', () => {
    const r = calculateTax('lci_lca', 100000, 80000, '2026-06-15');
    expect(r.isExempt).toBe(true);
    expect(r.taxDue).toBe(0);
  });
});

describe('calculateTax — renda fixa (tabela regressiva)', () => {
  const sell = '2026-06-15';
  const daysAgo = (n: number) => {
    const d = new Date(`${sell}T12:00:00`);
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  it('até 180 dias → 22,5%', () => {
    const r = calculateTax('renda_fixa', 11000, 10000, sell, daysAgo(100));
    expect(r.taxRate).toBe(0.225);
    expect(r.taxDue).toBeCloseTo(1000 * 0.225, 2);
  });

  it('181–360 dias → 20%', () => {
    const r = calculateTax('renda_fixa', 11000, 10000, sell, daysAgo(300));
    expect(r.taxRate).toBe(0.20);
  });

  it('361–720 dias → 17,5%', () => {
    const r = calculateTax('renda_fixa', 11000, 10000, sell, daysAgo(500));
    expect(r.taxRate).toBe(0.175);
  });

  it('acima de 720 dias → 15%', () => {
    const r = calculateTax('renda_fixa', 11000, 10000, sell, daysAgo(900));
    expect(r.taxRate).toBe(0.15);
  });

  it('sem data de compra assume prazo longo (15%)', () => {
    const r = calculateTax('renda_fixa', 11000, 10000, sell);
    expect(r.taxRate).toBe(0.15);
  });
});

describe('calculateTax — crypto', () => {
  it('isenta quando vendas do mês ≤ R$ 35.000 (limite exato)', () => {
    const r = calculateTax('crypto', 35000, 20000, '2026-06-15');
    expect(r.isExempt).toBe(true);
    expect(r.taxDue).toBe(0);
  });

  it('tributa 15% quando ultrapassa R$ 35.000 com lucro até R$ 5M', () => {
    const r = calculateTax('crypto', 40000, 30000, '2026-06-15');
    expect(r.isExempt).toBe(false);
    expect(r.taxRate).toBe(0.15);
    expect(r.taxDue).toBeCloseTo(10000 * 0.15, 2);
  });

  it('soma vendas anteriores do mês para o teto', () => {
    const r = calculateTax('crypto', 10000, 5000, '2026-06-15', undefined, 30000);
    expect(r.isExempt).toBe(false);
  });

  it('alíquota progressiva sobe conforme o lucro', () => {
    // lucro de 6M → 17,5%
    const r1 = calculateTax('crypto', 10_000_000, 4_000_000, '2026-06-15');
    expect(r1.taxRate).toBe(0.175);
    // lucro de 20M → 20%
    const r2 = calculateTax('crypto', 30_000_000, 10_000_000, '2026-06-15');
    expect(r2.taxRate).toBe(0.20);
    // lucro de 40M → 22,5%
    const r3 = calculateTax('crypto', 50_000_000, 10_000_000, '2026-06-15');
    expect(r3.taxRate).toBe(0.225);
  });
});
