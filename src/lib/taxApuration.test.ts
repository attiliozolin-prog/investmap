import { describe, it, expect } from 'vitest';
import { apurarIR, darfDueDate, isCostPending, type DarfPayment } from './taxApuration';
import type { AssetType, SellTaxRecord } from '@/types';

let seq = 0;
function sale(
  assetType: AssetType, sellDate: string, sellValue: number, costBasis: number,
  extra: Partial<SellTaxRecord> = {},
): SellTaxRecord {
  seq++;
  const profitLoss = sellValue - costBasis;
  return {
    id: `r${seq}`, assetId: `a${seq}`, assetTicker: `T${seq}`,
    sellValue, costBasis, profitLoss, assetType,
    taxRate: 0, taxDue: 0, isExempt: false, isLoss: profitLoss < 0,
    lossUsedForCompensation: 0, taxPaid: false, sellDate, createdAt: sellDate,
    ...extra,
  };
}

function payment(period: string, darfCode: '6015' | '4600', amount: number): DarfPayment {
  return { id: `p-${period}-${amount}`, period, darfCode, amount, paidAt: `${period}-28`, createdAt: '' };
}

const TODAY = '2026-09-23';

describe('darfDueDate', () => {
  it('vence no último dia útil do mês seguinte', () => {
    expect(darfDueDate('2026-03')).toBe('2026-04-30'); // quinta
    expect(darfDueDate('2026-04')).toBe('2026-05-29'); // 31/05 é domingo → sexta 29
    expect(darfDueDate('2026-12')).toBe('2027-01-29'); // 31/01/2027 é domingo
  });
});

describe('apurarIR — isenção de ações é do MÊS, não da venda', () => {
  it('duas vendas que juntas passam de R$ 20 mil tributam as duas', () => {
    const a = sale('acao', '2026-03-05', 15_000, 10_000);
    const b = sale('acao', '2026-03-20', 10_000, 8_000);
    const ap = apurarIR([a, b], [], TODAY);
    const m = ap.months[0];
    expect(m.acoesExempt).toBe(false);
    expect(m.groups.bolsa.tax).toBe(1050); // (5.000 + 2.000) × 15%
    expect(ap.saleStatus[a.id]).toBe('tributavel');
    expect(ap.saleStatus[b.id]).toBe('tributavel');
  });

  it('vendas até R$ 20 mil no mês ficam isentas', () => {
    const a = sale('acao', '2026-03-05', 12_000, 10_000);
    const b = sale('acao', '2026-03-20', 8_000, 5_000);
    const ap = apurarIR([a, b], [], TODAY);
    expect(ap.months[0].acoesExempt).toBe(true);
    expect(ap.months[0].groups.bolsa.exemptProfit).toBe(5_000);
    expect(ap.darfs).toHaveLength(0);
    expect(ap.saleStatus[a.id]).toBe('isento');
  });

  it('ETF e BDR não entram no teto e não têm isenção', () => {
    const etf = sale('etf', '2026-03-05', 5_000, 4_000);
    const acao = sale('acao', '2026-03-10', 5_000, 4_000);
    const ap = apurarIR([etf, acao], [], TODAY);
    expect(ap.months[0].acoesExempt).toBe(true);
    expect(ap.months[0].groups.bolsa.tax).toBe(150); // só o ETF
    expect(ap.saleStatus[etf.id]).toBe('tributavel');
    expect(ap.saleStatus[acao.id]).toBe('isento');
  });
});

describe('apurarIR — compensação de prejuízo', () => {
  it('prejuízo de um mês abate o lucro do mês seguinte (bolsa)', () => {
    const loss = sale('etf', '2026-01-10', 10_000, 14_000);  // -4.000
    const gain = sale('etf', '2026-02-10', 20_000, 14_000);  // +6.000
    const ap = apurarIR([loss, gain], [], TODAY);
    const feb = ap.months[1].groups.bolsa;
    expect(feb.lossCarryIn).toBe(4_000);
    expect(feb.lossUsed).toBe(4_000);
    expect(feb.base).toBe(2_000);
    expect(feb.tax).toBe(300);
    expect(ap.lossCarry.bolsa).toBe(0);
  });

  it('prejuízo de ações em mês isento continua compensável', () => {
    const loss = sale('acao', '2026-01-10', 5_000, 8_000);    // -3.000, mês isento
    const gain = sale('acao', '2026-02-10', 30_000, 25_000);  // +5.000, mês tributável
    const ap = apurarIR([loss, gain], [], TODAY);
    expect(ap.months[1].groups.bolsa.base).toBe(2_000);
    expect(ap.months[1].groups.bolsa.tax).toBe(300);
  });

  it('lucro isento de ações não consome prejuízo acumulado', () => {
    const loss = sale('etf', '2026-01-10', 5_000, 8_000);     // -3.000
    const exempt = sale('acao', '2026-02-10', 10_000, 6_000); // +4.000 isento
    const ap = apurarIR([loss, exempt], [], TODAY);
    expect(ap.months[1].groups.bolsa.lossUsed).toBe(0);
    expect(ap.lossCarry.bolsa).toBe(3_000);
  });

  it('prejuízo de FII só compensa FII', () => {
    const fiiLoss = sale('fii', '2026-01-10', 5_000, 7_000);  // -2.000
    const etfGain = sale('etf', '2026-02-10', 10_000, 8_000); // +2.000
    const fiiGain = sale('fii', '2026-02-15', 9_000, 6_000);  // +3.000
    const ap = apurarIR([fiiLoss, etfGain, fiiGain], [], TODAY);
    const feb = ap.months[1];
    expect(feb.groups.bolsa.tax).toBe(300);  // 2.000 × 15%, sem abater o FII
    expect(feb.groups.fii.base).toBe(1_000); // 3.000 − 2.000
    expect(feb.groups.fii.tax).toBe(200);
    expect(feb.darfs[0].tax).toBe(500);      // um DARF 6015 somando os dois
  });

  it('lucro e prejuízo do mesmo mês se compensam antes da alíquota', () => {
    const gain = sale('etf', '2026-03-05', 10_000, 7_000);  // +3.000
    const loss = sale('bdr', '2026-03-20', 4_000, 5_000);   // -1.000
    const ap = apurarIR([gain, loss], [], TODAY);
    expect(ap.months[0].groups.bolsa.tax).toBe(300);
  });

  it('a ordem de lançamento não altera o resultado', () => {
    const recs = [
      sale('etf', '2026-02-10', 20_000, 14_000),
      sale('etf', '2026-01-10', 10_000, 14_000),
    ];
    const a = apurarIR(recs, [], TODAY);
    const b = apurarIR([...recs].reverse(), [], TODAY);
    expect(a.darfs).toEqual(b.darfs);
  });
});

describe('apurarIR — cripto', () => {
  it('isento até R$ 35 mil vendidos no mês', () => {
    const ap = apurarIR([sale('crypto', '2026-03-05', 30_000, 20_000)], [], TODAY);
    expect(ap.months[0].criptoExempt).toBe(true);
    expect(ap.darfs).toHaveLength(0);
  });

  it('acima de R$ 35 mil tributa 15% com DARF 4600, sem compensar prejuízo anterior', () => {
    const loss = sale('crypto', '2026-01-05', 40_000, 50_000);
    const gain = sale('crypto', '2026-02-05', 40_000, 30_000);
    const ap = apurarIR([loss, gain], [], TODAY);
    const darf = ap.darfs.find(d => d.period === '2026-02')!;
    expect(darf.code).toBe('4600');
    expect(darf.tax).toBe(1_500);
  });
});

describe('apurarIR — fora do DARF', () => {
  it('renda fixa e LCI não geram DARF', () => {
    const rf = sale('renda_fixa', '2026-03-05', 11_000, 10_000);
    const lci = sale('lci_lca', '2026-03-05', 11_000, 10_000);
    const ap = apurarIR([rf, lci], [], TODAY);
    expect(ap.darfs).toHaveLength(0);
    expect(ap.saleStatus[rf.id]).toBe('retido_fonte');
    expect(ap.saleStatus[lci.id]).toBe('isento');
    expect(ap.months[0].withheldProfit).toBe(1_000);
  });
});

describe('apurarIR — custo pendente', () => {
  it('não calcula IR sobre o valor inteiro, mas conta no teto de isenção', () => {
    const pending = sale('acao', '2026-03-05', 50_000, 0);
    const known = sale('acao', '2026-03-10', 5_000, 4_000);
    const ap = apurarIR([pending, known], [], TODAY);
    const m = ap.months[0];
    expect(isCostPending(pending)).toBe(true);
    expect(m.acoesExempt).toBe(false);          // 55 mil vendidos
    expect(m.groups.bolsa.tax).toBe(150);       // só a venda com custo
    expect(m.darfs[0].incomplete).toBe(true);
    expect(ap.saleStatus[pending.id]).toBe('custo_pendente');
  });
});

describe('apurarIR — DARF mínimo, vencimento e pagamentos', () => {
  it('abaixo de R$ 10 acumula para o mês seguinte', () => {
    const small = sale('etf', '2026-01-10', 1_040, 1_000);  // IR 6,00
    const next = sale('etf', '2026-02-10', 1_040, 1_000);   // IR 6,00
    const ap = apurarIR([small, next], [], TODAY);
    expect(ap.darfs[0].status).toBe('abaixo_minimo');
    expect(ap.darfs[1].carryIn).toBe(6);
    expect(ap.darfs[1].total).toBe(12);
    expect(ap.darfs[1].status).toBe('atrasado');
  });

  it('pendente dentro do prazo, atrasado depois do vencimento', () => {
    const aug = sale('etf', '2026-08-10', 10_000, 8_000);
    const jul = sale('etf', '2026-07-10', 10_000, 8_000);
    const ap = apurarIR([aug, jul], [], TODAY); // hoje 23/09/2026
    expect(ap.darfs.find(d => d.period === '2026-08')!.status).toBe('pendente'); // vence 30/09
    expect(ap.darfs.find(d => d.period === '2026-07')!.status).toBe('atrasado'); // venceu 31/08
  });

  it('pagamento registrado quita o DARF; venda nova no mês gera complementar', () => {
    const first = sale('etf', '2026-08-05', 10_000, 8_000);  // IR 300
    const paid = apurarIR([first], [payment('2026-08', '6015', 300)], TODAY);
    expect(paid.darfs[0].status).toBe('pago');

    const later = sale('etf', '2026-08-25', 5_000, 4_000);   // +IR 150
    const ap = apurarIR([first, later], [payment('2026-08', '6015', 300)], TODAY);
    expect(ap.darfs[0].open).toBe(150);
    expect(ap.darfs[0].complementar).toBe(true);
  });

  it('pagamentos do modelo antigo (por venda) contam como pagos', () => {
    const r = sale('etf', '2026-08-05', 10_000, 8_000, { taxDue: 300, taxPaid: true });
    const ap = apurarIR([r], [], TODAY);
    expect(ap.darfs[0].paid).toBe(300);
    expect(ap.darfs[0].status).toBe('pago');
  });

  it('pagou mais que o apurado (ex.: prejuízo compensado depois) → pago a mais', () => {
    const loss = sale('etf', '2026-07-05', 6_000, 8_000);  // -2.000
    const r = sale('etf', '2026-08-05', 10_000, 8_000, { taxDue: 300, taxPaid: true });
    const ap = apurarIR([loss, r], [], TODAY);
    const aug = ap.darfs.find(d => d.period === '2026-08')!;
    expect(aug.total).toBe(0);
    expect(aug.status).toBe('pago_a_mais');
  });
});
