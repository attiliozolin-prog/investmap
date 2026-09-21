import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  fetchQuotesInBatches,
  createQuarantine,
  type ChunkResponse,
} from '@/lib/brapiQuotes';

/**
 * Proxy autenticado para a Brapi.
 * Mantém o token fora do bundle do client e permite cache compartilhado.
 *
 * GET /api/quotes?tickers=PETR4,IVVB11,HGLG11
 * → { prices: { "PETR4": 38.42, ... }, failed: ["..."] }
 *
 * A estratégia de lote, serialização e retry vive em `@/lib/brapiQuotes`,
 * que é testável sem subir o Next. Aqui fica só o que é específico de
 * HTTP: autenticação, validação de entrada e política de cache.
 */

// Token server-side; aceita o nome antigo NEXT_PUBLIC_* para não quebrar
// ambientes existentes até a variável ser renomeada.
// `||` e não `??`: um `BRAPI_TOKEN=` vazio no .env é string vazia, que não
// é nullish — com `??` ele encobria o nome antigo e a API ia sem token.
const BRAPI_TOKEN = process.env.BRAPI_TOKEN || process.env.NEXT_PUBLIC_BRAPI_TOKEN || '';

const MAX_TICKERS = 50;

// Generoso para uso legítimo (sync a cada 5min), apertado contra abuso
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const TICKER_RE = /^[A-Z0-9]{1,10}$/;

// Alinhado ao intervalo de sync durante o pregão (5 min). Era 30 min, o
// que tinha dois problemas: o preço na tela podia estar meia hora atrasado
// e — pior — uma resposta de ERRO ficava cacheada todo esse tempo, então
// um 429 passageiro deixava o ativo sem cotação por 30 minutos. Com 5 min
// a janela encolhe, e a segunda tentativa com `no-store` (abaixo) fura o
// cache de vez.
const CACHE_TTL_SECONDS = 300;

// A quarentena vive no escopo do módulo, como o rateLimit. Em serverless
// cada instância tem a sua, então o pior caso de uma instância fria é
// repetir a bissecção uma vez — barato e autocorrigível.
const quarantine = createQuarantine();

function parseRetryAfterMs(res: Response): number {
  const header = res.headers.get('retry-after') ?? res.headers.get('ratelimit-reset');
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const limit = checkRateLimit(`quotes:${user.id}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições de cotação. Aguarde alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const tickersParam = req.nextUrl.searchParams.get('tickers') ?? '';
  const tickers = Array.from(new Set(
    tickersParam
      .split(',')
      .map(t => t.trim().toUpperCase())
      .filter(t => TICKER_RE.test(t))
  )).slice(0, MAX_TICKERS);

  if (tickers.length === 0) {
    return NextResponse.json({ error: 'Nenhum ticker válido informado.' }, { status: 400 });
  }

  const tokenParam = BRAPI_TOKEN ? `?token=${BRAPI_TOKEN}` : '';

  const fetchChunk = async (
    chunk: string[],
    { fresh }: { fresh: boolean },
  ): Promise<ChunkResponse> => {
    try {
      const res = await fetch(
        `https://brapi.dev/api/quote/${chunk.join(',')}${tokenParam}`,
        fresh
          // Segunda tentativa: ignora o cache do Next de propósito, para
          // que uma resposta de erro cacheada não se perpetue.
          ? { cache: 'no-store' }
          : { next: { revalidate: CACHE_TTL_SECONDS } },
      );

      if (!res.ok) {
        return { ok: false, status: res.status, retryAfterMs: parseRetryAfterMs(res) };
      }

      const data = await res.json() as {
        results?: { symbol: string; regularMarketPrice: number }[];
      };

      const prices: Record<string, number> = {};
      for (const item of data.results ?? []) {
        const price = item.regularMarketPrice;
        if (price != null && !isNaN(price)) {
          prices[item.symbol.replace(/\.SA$/i, '').toUpperCase()] = price;
        }
      }
      return { ok: true, prices };
    } catch {
      // Erro de rede: trata como transitório (status 0 não é 429, então
      // não dispara bissecção nem quarentena).
      return { ok: false, status: 0, retryAfterMs: 0 };
    }
  };

  const { prices, failed, quarantined, requests } = await fetchQuotesInBatches(
    tickers,
    fetchChunk,
    { quarantine },
  );

  if (failed.length > 0) {
    console.error(
      `[quotes] sem cotação para: ${failed.join(', ')} ` +
      `(${requests} req à Brapi${quarantined.length ? `; em quarentena: ${quarantined.join(', ')}` : ''})`
    );
  }

  return NextResponse.json({ prices, failed });
}
