import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * Proxy autenticado para a Brapi.
 * Mantém o token fora do bundle do client e permite cache compartilhado.
 *
 * GET /api/quotes?tickers=PETR4,IVVB11,HGLG11
 * → { prices: { "PETR4": 38.42, ... } }
 */

// Token server-side; aceita o nome antigo NEXT_PUBLIC_* para não quebrar
// ambientes existentes até a variável ser renomeada.
const BRAPI_TOKEN = process.env.BRAPI_TOKEN ?? process.env.NEXT_PUBLIC_BRAPI_TOKEN ?? '';

const MAX_TICKERS = 50;
// O plano GRATUITO da Brapi aceita apenas 1 ticker por requisição
// (Startup: 10, Pro: 20). Com chunks >1 a Brapi rejeita a chamada inteira
// e o sync em lote falha silenciosamente — por isso 1 ticker por request.
const CHUNK_SIZE = 1;

// Generoso para uso legítimo (sync a cada 5min), apertado contra abuso
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const TICKER_RE = /^[A-Z0-9]{1,10}$/;

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

  const prices: Record<string, number> = {};
  const tokenParam = BRAPI_TOKEN ? `?token=${BRAPI_TOKEN}` : '';

  const chunks: string[][] = [];
  for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
    chunks.push(tickers.slice(i, i + CHUNK_SIZE));
  }

  const failures: string[] = [];

  await Promise.all(chunks.map(async chunk => {
    try {
      const res = await fetch(
        `https://brapi.dev/api/quote/${chunk.join(',')}${tokenParam}`,
        // Cache compartilhado do Next alinhado ao ciclo de sync do client
        // (5 min): cada ticker consome no máx. 1 requisição da cota da
        // Brapi a cada 5 min, para todos os usuários somados.
        { next: { revalidate: 300 } }
      );
      if (!res.ok) {
        failures.push(`${chunk.join(',')} (HTTP ${res.status})`);
        return;
      }
      const data = await res.json() as { results?: { symbol: string; regularMarketPrice: number }[] };
      for (const item of data.results ?? []) {
        const price = item.regularMarketPrice;
        if (price != null && !isNaN(price)) {
          const symbol = item.symbol.replace(/\.SA$/i, '').toUpperCase();
          prices[symbol] = price;
        }
      }
    } catch (e) {
      // chunk com falha não derruba os demais
      failures.push(`${chunk.join(',')} (${e instanceof Error ? e.message : 'erro de rede'})`);
    }
  }));

  if (failures.length > 0) {
    console.error(`[quotes] Brapi falhou para: ${failures.join('; ')}`);
  }

  return NextResponse.json({ prices });
}
