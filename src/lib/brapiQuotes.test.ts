import { describe, it, expect } from 'vitest';
import {
  fetchQuotesInBatches,
  createQuarantine,
  QUARANTINE_MS,
  type ChunkResponse,
  type FetchChunk,
} from './brapiQuotes';

const noSleep = async () => {};

/**
 * Fábrica de um `fetchChunk` falso que registra as chamadas e detecta
 * qualquer concorrência — o limite da Brapi é 1 requisição simultânea,
 * então paralelismo é bug, não detalhe de performance.
 */
function makeFetch(
  handler: (tickers: string[], opts: { fresh: boolean }) => ChunkResponse,
) {
  const calls: { tickers: string[]; fresh: boolean }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const fetchChunk: FetchChunk = async (tickers, opts) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    calls.push({ tickers: [...tickers], fresh: opts.fresh });
    // Cede o event loop: se houvesse paralelismo, apareceria aqui.
    await Promise.resolve();
    const res = handler(tickers, opts);
    inFlight--;
    return res;
  };

  return { fetchChunk, calls, get maxInFlight() { return maxInFlight; } };
}

const priceAll = (tickers: string[]): ChunkResponse => ({
  ok: true,
  prices: Object.fromEntries(tickers.map((t, i) => [t, 10 + i])),
});

const tickers = (n: number, prefix = 'T') =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('agrupamento', () => {
  it('manda 20 tickers numa única chamada', async () => {
    const f = makeFetch(priceAll);
    const r = await fetchQuotesInBatches(tickers(20), f.fetchChunk, { sleep: noSleep });

    expect(f.calls).toHaveLength(1);
    expect(r.requests).toBe(1);
    expect(Object.keys(r.prices)).toHaveLength(20);
    expect(r.failed).toEqual([]);
  });

  it('parte em lotes de 20 quando passa disso', async () => {
    const f = makeFetch(priceAll);
    const r = await fetchQuotesInBatches(tickers(45), f.fetchChunk, { sleep: noSleep });

    expect(f.calls.map(c => c.tickers.length)).toEqual([20, 20, 5]);
    expect(r.requests).toBe(3);
  });

  it('deduplica antes de montar os lotes', async () => {
    const f = makeFetch(priceAll);
    await fetchQuotesInBatches(['PETR4', 'PETR4', 'ITUB4'], f.fetchChunk, { sleep: noSleep });
    expect(f.calls[0].tickers).toEqual(['PETR4', 'ITUB4']);
  });

  it('nunca dispara duas chamadas ao mesmo tempo', async () => {
    const f = makeFetch(priceAll);
    await fetchQuotesInBatches(tickers(100), f.fetchChunk, { sleep: noSleep });
    expect(f.maxInFlight).toBe(1);
  });
});

describe('429 — limite de concorrência ou taxa', () => {
  it('espera e repete uma vez, ignorando cache na segunda tentativa', async () => {
    let first = true;
    const f = makeFetch(ts => {
      if (first) {
        first = false;
        return { ok: false, status: 429, retryAfterMs: 1000 };
      }
      return priceAll(ts);
    });

    const waited: number[] = [];
    const r = await fetchQuotesInBatches(['PETR4'], f.fetchChunk, {
      sleep: async ms => { waited.push(ms); },
    });

    expect(waited).toEqual([1000]);
    expect(f.calls.map(c => c.fresh)).toEqual([false, true]);
    expect(r.prices.PETR4).toBe(10);
    expect(r.failed).toEqual([]);
  });

  it('429 persistente não coloca ticker bom em quarentena', async () => {
    const f = makeFetch(() => ({ ok: false, status: 429, retryAfterMs: 1 }));
    const q = createQuarantine();

    const r = await fetchQuotesInBatches(['PETR4', 'ITUB4'], f.fetchChunk, {
      sleep: noSleep,
      quarantine: q,
    });

    expect(r.quarantined).toEqual([]);
    expect(q.size).toBe(0);
    expect(r.failed).toEqual(['PETR4', 'ITUB4']);
    // Duas chamadas apenas (original + retry) — não bissecta.
    expect(r.requests).toBe(2);
  });
});

describe('ticker inválido derrubando o lote', () => {
  // Reproduz o comportamento observado na Brapi: o lote inteiro falha se
  // contiver um ticker inválido, mesmo que os demais sejam válidos.
  const withPoison = (poison: string) => (ts: string[]): ChunkResponse =>
    ts.includes(poison)
      ? { ok: false, status: 404, retryAfterMs: 0 }
      : priceAll(ts);

  it('isola o culpado por bissecção e salva os demais', async () => {
    const all = [...tickers(9), 'LIXO99'];
    const f = makeFetch(withPoison('LIXO99'));

    const r = await fetchQuotesInBatches(all, f.fetchChunk, { sleep: noSleep });

    expect(r.quarantined).toEqual(['LIXO99']);
    expect(r.failed).toEqual(['LIXO99']);
    // Os 9 válidos voltaram com preço, apesar do lote inicial ter falhado.
    expect(Object.keys(r.prices).sort()).toEqual(tickers(9).sort());
    // Bissecção é logarítmica: bem menos que uma chamada por ticker.
    expect(r.requests).toBeLessThan(all.length);
  });

  it('não repete a bissecção na sync seguinte — quarentena exclui o ticker', async () => {
    const q = createQuarantine();
    const all = ['PETR4', 'ITUB4', 'LIXO99'];

    const f1 = makeFetch(withPoison('LIXO99'));
    await fetchQuotesInBatches(all, f1.fetchChunk, { sleep: noSleep, quarantine: q });

    const f2 = makeFetch(withPoison('LIXO99'));
    const r2 = await fetchQuotesInBatches(all, f2.fetchChunk, { sleep: noSleep, quarantine: q });

    expect(f2.calls).toHaveLength(1);
    expect(f2.calls[0].tickers).toEqual(['PETR4', 'ITUB4']);
    expect(r2.prices).toEqual({ PETR4: 10, ITUB4: 11 });
    // Continua reportado como sem cotação — o aviso ao usuário é honesto.
    expect(r2.failed).toEqual(['LIXO99']);
  });

  it('a quarentena expira e o ticker volta a ser tentado', async () => {
    const q = createQuarantine();
    let clock = 1_000_000;
    const all = ['PETR4', 'LIXO99'];

    const f1 = makeFetch(withPoison('LIXO99'));
    await fetchQuotesInBatches(all, f1.fetchChunk, {
      sleep: noSleep, quarantine: q, now: () => clock,
    });
    expect(q.has('LIXO99')).toBe(true);

    clock += QUARANTINE_MS + 1;

    // Desta vez a Brapi aceita o ticker (papel recém-listado, por ex.).
    const f2 = makeFetch(priceAll);
    const r2 = await fetchQuotesInBatches(all, f2.fetchChunk, {
      sleep: noSleep, quarantine: q, now: () => clock,
    });

    expect(f2.calls[0].tickers).toEqual(['PETR4', 'LIXO99']);
    expect(r2.prices.LIXO99).toBeDefined();
    expect(q.has('LIXO99')).toBe(false);
  });
});

describe('teto de requisições', () => {
  it('nunca passa do orçamento, mesmo com tudo falhando', async () => {
    const f = makeFetch(() => ({ ok: false, status: 500, retryAfterMs: 0 }));
    const r = await fetchQuotesInBatches(tickers(40), f.fetchChunk, {
      sleep: noSleep,
      maxRequests: 5,
    });

    expect(r.requests).toBeLessThanOrEqual(5);
    expect(f.calls.length).toBeLessThanOrEqual(5);
  });
});

describe('resultado', () => {
  it('lista como falha o ticker que a Brapi simplesmente omitiu', async () => {
    // A Brapi responde 200 mas sem o papel no `results`.
    const f = makeFetch(() => ({ ok: true, prices: { PETR4: 42 } }));
    const r = await fetchQuotesInBatches(['PETR4', 'HGLG11'], f.fetchChunk, { sleep: noSleep });

    expect(r.prices).toEqual({ PETR4: 42 });
    expect(r.failed).toEqual(['HGLG11']);
    // Omissão não é motivo para quarentena: o ticker pode ser válido e
    // estar só sem negócio no momento.
    expect(r.quarantined).toEqual([]);
  });
});
