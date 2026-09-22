import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  markPriceFresh,
  selectStaleEnoughToWarn,
  resetPriceFreshness,
  STALE_WARNING_MS,
} from './priceFreshness';

// O ambiente de teste é node: localStorage não existe. Stub mínimo, que
// também serve para exercitar o caminho "storage indisponível".
function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: () => null,
    length: 0,
  } as Storage;
  return store;
}

function removeLocalStorage() {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
}

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

beforeEach(() => {
  installLocalStorage();
  resetPriceFreshness();
});

afterEach(() => {
  removeLocalStorage();
});

describe('silêncio no caso comum', () => {
  it('não avisa quando o preço é de minutos atrás', () => {
    markPriceFresh(['PETR4'], T0);
    // Falhou agora, mas tem cotação de 10 minutos atrás: irrelevante.
    expect(selectStaleEnoughToWarn(['PETR4'], T0 + 10 * 60 * 1000)).toEqual([]);
  });

  it('não avisa durante um fim de semana prolongado', () => {
    markPriceFresh(['CSMG3'], T0);
    // Quinta a terça com feriado emendado: ~4 dias sem pregão, e o preço
    // de fechamento continua sendo o valor certo.
    expect(selectStaleEnoughToWarn(['CSMG3'], T0 + 4 * DAY)).toEqual([]);
  });

  it('fica quieto na primeira falha de um ticker desconhecido', () => {
    expect(selectStaleEnoughToWarn(['NOVO11'], T0)).toEqual([]);
  });
});

describe('aviso quando o dado realmente envelhece', () => {
  it('avisa depois de passar do limite', () => {
    markPriceFresh(['CSMG3'], T0);
    expect(selectStaleEnoughToWarn(['CSMG3'], T0 + STALE_WARNING_MS + 1)).toEqual(['CSMG3']);
  });

  it('um ticker quebrado desde sempre aparece após o prazo, não some', () => {
    // Primeira falha só registra o marco.
    expect(selectStaleEnoughToWarn(['LIXO99'], T0)).toEqual([]);
    // Passado o prazo contado a partir daquele marco, o aviso vem.
    expect(selectStaleEnoughToWarn(['LIXO99'], T0 + STALE_WARNING_MS + 1)).toEqual(['LIXO99']);
  });

  it('uma cotação boa zera o relógio', () => {
    markPriceFresh(['CSMG3'], T0);
    markPriceFresh(['CSMG3'], T0 + 4 * DAY);
    // 4 dias depois do primeiro registro, mas o segundo é recente.
    expect(selectStaleEnoughToWarn(['CSMG3'], T0 + 5 * DAY)).toEqual([]);
  });

  it('avisa só dos velhos, deixando os recentes de fora', () => {
    markPriceFresh(['PETR4'], T0 + 6 * DAY);
    markPriceFresh(['CSMG3'], T0);
    const warn = selectStaleEnoughToWarn(['PETR4', 'CSMG3'], T0 + 6 * DAY);
    expect(warn).toEqual(['CSMG3']);
  });
});

describe('robustez', () => {
  it('não quebra sem localStorage (SSR) e prefere o silêncio', () => {
    removeLocalStorage();
    expect(() => markPriceFresh(['PETR4'], T0)).not.toThrow();
    expect(selectStaleEnoughToWarn(['PETR4'], T0 + 10 * DAY)).toEqual([]);
  });

  it('ignora conteúdo corrompido no storage', () => {
    localStorage.setItem('investmap_price_last_ok', '{ isso não é json');
    expect(selectStaleEnoughToWarn(['PETR4'], T0)).toEqual([]);
    expect(() => markPriceFresh(['PETR4'], T0)).not.toThrow();
  });

  it('trata o ticker sem diferenciar maiúsculas', () => {
    markPriceFresh(['petr4'], T0);
    expect(selectStaleEnoughToWarn(['PETR4'], T0 + DAY)).toEqual([]);
  });

  it('lista vazia não mexe em nada', () => {
    expect(selectStaleEnoughToWarn([], T0)).toEqual([]);
  });
});
