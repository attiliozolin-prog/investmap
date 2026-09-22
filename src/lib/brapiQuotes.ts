/**
 * Orquestra as chamadas à Brapi respeitando os limites do plano gratuito.
 *
 * Limites medidos na API (headers da própria resposta):
 *   - concorrência: 1 requisição simultânea (`x-brapi-concurrency-limit: 1`)
 *   - taxa:         20 req/min (`ratelimit-limit` / `ratelimit-reset`)
 *   - cota:         15.000 req/mês
 *   - lote:         até 20 tickers por chamada, custando 1 requisição
 *
 * O custo de 1 requisição por lote foi verificado observando o header
 * `ratelimit-remaining` cair de 1 em 1 com chamadas de 1 e de 4 tickers.
 * É por isso que agrupar vale tanto: 20 ativos passam a custar o mesmo
 * que 1.
 *
 * Três regras nascem desses limites:
 *
 * 1. NUNCA em paralelo. A versão anterior disparava um `Promise.all` com
 *    uma requisição por ticker; contra um limite de concorrência de 1, a
 *    maioria voltava 429 e os ativos apareciam sem cotação.
 * 2. 429 é transitório. O erro de concorrência traz `retry-after: 1` —
 *    basta esperar e repetir uma vez.
 * 3. Lote é tudo-ou-nada. Um ticker inválido derruba a chamada inteira
 *    (confirmado: `PETR4` responde 200, `PETR4,LIXO99` responde erro sem
 *    resultado nenhum). Como o usuário digita o ticker à mão e a
 *    validação é só de formato, um typo poderia zerar a carteira toda.
 *    Daí a bissecção: ao falhar um lote por motivo não-transitório, ele é
 *    partido ao meio até isolar o culpado, que vai para quarentena e sai
 *    dos lotes seguintes.
 */

export type ChunkResponse =
  | { ok: true; prices: Record<string, number> }
  | { ok: false; status: number; retryAfterMs: number };

/**
 * Busca um lote. `fresh` pede para ignorar cache — usado na segunda
 * tentativa, para que uma resposta de erro eventualmente cacheada não
 * congele o ticker até o fim do TTL.
 */
export type FetchChunk = (
  tickers: string[],
  opts: { fresh: boolean },
) => Promise<ChunkResponse>;

/** ticker → instante (ms) em que a quarentena expira. */
export type Quarantine = Map<string, number>;

export function createQuarantine(): Quarantine {
  return new Map();
}

export const CHUNK_SIZE = 20;

// Um ticker isolado como inválido fica de fora por 1h.
//
// Era 6h, o que tinha um efeito ruim: durante a quarentena o ticker nunca
// é tentado, então uma indisponibilidade de 30 segundos da Brapi deixava
// o papel sem atualizar por um turno inteiro e parecia defeito permanente.
// Uma hora ainda evita repetir a bissecção a cada sync de 5 min (o motivo
// da quarentena existir) e devolve o ticker rápido quando o erro passa.
export const QUARANTINE_MS = 60 * 60 * 1000;

// Teto defensivo de chamadas por invocação. A bissecção é logarítmica,
// mas uma carteira com muitos tickers ruins ao mesmo tempo poderia
// multiplicar as chamadas; este limite garante que um sync nunca consuma
// mais que isso da cota, aconteça o que acontecer.
export const MAX_REQUESTS_PER_SYNC = 30;

const DEFAULT_RETRY_MS = 1000;

export type BatchResult = {
  prices: Record<string, number>;
  /** Tickers pedidos que não voltaram com preço. */
  failed: string[];
  /** Tickers isolados como inválidos nesta rodada. */
  quarantined: string[];
  /** Chamadas efetivamente feitas à Brapi (para log e diagnóstico). */
  requests: number;
};

type Ctx = {
  fetchChunk: FetchChunk;
  sleep: (ms: number) => Promise<void>;
  quarantine: Quarantine;
  now: () => number;
  budget: { left: number };
  prices: Record<string, number>;
  quarantined: string[];
  requests: number;
};

const defaultSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Processa um lote, partindo-o ao meio quando a falha não é transitória.
 * Sempre sequencial — nunca dispara duas chamadas ao mesmo tempo.
 */
async function processChunk(tickers: string[], ctx: Ctx): Promise<void> {
  if (tickers.length === 0) return;
  if (ctx.budget.left <= 0) return;

  ctx.budget.left--;
  ctx.requests++;
  let res = await ctx.fetchChunk(tickers, { fresh: false });

  // 429 = limite de concorrência ou de taxa. Sempre transitório: espera o
  // que a própria Brapi pediu e tenta de novo, uma única vez. `fresh`
  // porque a primeira resposta pode ter vindo de um erro cacheado.
  if (!res.ok && res.status === 429 && ctx.budget.left > 0) {
    await ctx.sleep(res.retryAfterMs || DEFAULT_RETRY_MS);
    ctx.budget.left--;
    ctx.requests++;
    res = await ctx.fetchChunk(tickers, { fresh: true });
  }

  if (res.ok) {
    Object.assign(ctx.prices, res.prices);
    return;
  }

  // 429 que sobreviveu ao retry é limite de taxa, não ticker ruim.
  // Bissectar aqui só gastaria mais chamadas contra um limite já
  // estourado, e a quarentena puniria um ticker saudável. Desiste do
  // lote: os tickers entram como "sem cotação" e a próxima sync tenta
  // de novo.
  if (res.status === 429) return;

  // Falha não transitória num lote de 1: o ticker é o problema.
  if (tickers.length === 1) {
    const bad = tickers[0];
    ctx.quarantine.set(bad, ctx.now() + QUARANTINE_MS);
    ctx.quarantined.push(bad);
    return;
  }

  // Lote maior: parte ao meio para isolar o culpado. Os pedaços vão em
  // sequência, nunca em paralelo.
  const mid = Math.ceil(tickers.length / 2);
  await processChunk(tickers.slice(0, mid), ctx);
  await processChunk(tickers.slice(mid), ctx);
}

export async function fetchQuotesInBatches(
  tickers: string[],
  fetchChunk: FetchChunk,
  opts: {
    quarantine?: Quarantine;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
    chunkSize?: number;
    maxRequests?: number;
  } = {},
): Promise<BatchResult> {
  const quarantine = opts.quarantine ?? createQuarantine();
  const now = opts.now ?? Date.now;
  const chunkSize = opts.chunkSize ?? CHUNK_SIZE;

  const requested = Array.from(new Set(tickers));

  // Tira de circulação os tickers em quarentena (e limpa os vencidos).
  const eligible: string[] = [];
  for (const t of requested) {
    const until = quarantine.get(t);
    if (until != null && until > now()) continue;
    if (until != null) quarantine.delete(t);
    eligible.push(t);
  }

  const ctx: Ctx = {
    fetchChunk,
    sleep: opts.sleep ?? defaultSleep,
    quarantine,
    now,
    budget: { left: opts.maxRequests ?? MAX_REQUESTS_PER_SYNC },
    prices: {},
    quarantined: [],
    requests: 0,
  };

  for (const group of chunk(eligible, chunkSize)) {
    await processChunk(group, ctx);
  }

  const failed = requested.filter(t => ctx.prices[t] == null);

  return {
    prices: ctx.prices,
    failed,
    quarantined: ctx.quarantined,
    requests: ctx.requests,
  };
}
