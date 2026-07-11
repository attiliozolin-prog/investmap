import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rateLimit';
import { tickerToCoinId, CRYPTO_ID_TO_TICKER } from '@/lib/cryptoMap';

/**
 * Proxy autenticado para o CoinGecko (cotações de cripto em BRL).
 *
 * O endpoint público /simple/price NÃO exige API key. Mantemos o proxy
 * (como no /api/quotes da Brapi) por três motivos: exigir login, aplicar
 * rate-limit por usuário e compartilhar o cache do Next entre todos os
 * usuários — assim a cota do CoinGecko free (~10-30 req/min) não estoura.
 *
 * GET /api/quotes-crypto?tickers=BTC,ETH,SOL
 * → { prices: { "BTC": 350000.12, "ETH": 18000.5 } }
 */

// Chave Demo é OPCIONAL — só aumenta o limite. Sem ela, o endpoint público
// funciona normalmente.
const COINGECKO_DEMO_KEY = process.env.COINGECKO_API_KEY ?? '';

const MAX_TICKERS = 50;

// Generoso para uso legítimo, apertado contra abuso.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const TICKER_RE = /^[A-Z]{2,6}$/;

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const limit = checkRateLimit(`quotes-crypto:${user.id}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
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

  // Traduz ticker → id do CoinGecko; ignora os desconhecidos.
  const idByTicker = new Map<string, string>();
  for (const ticker of tickers) {
    const id = tickerToCoinId(ticker);
    if (id) idByTicker.set(ticker, id);
  }

  if (idByTicker.size === 0) {
    return NextResponse.json({ error: 'Nenhuma cripto reconhecida.' }, { status: 400 });
  }

  const ids = Array.from(new Set(idByTicker.values()));
  const prices: Record<string, number> = {};

  try {
    // Diferente da Brapi free (1 ticker/request), o CoinGecko aceita todos
    // os ids numa única chamada — bem mais econômico.
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=brl`;
    const res = await fetch(url, {
      headers: COINGECKO_DEMO_KEY ? { 'x-cg-demo-api-key': COINGECKO_DEMO_KEY } : undefined,
      // Cache compartilhado do Next (5 min): mantém o uso bem dentro da
      // cota do CoinGecko free mesmo com vários usuários simultâneos.
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error(`[quotes-crypto] CoinGecko HTTP ${res.status} para: ${ids.join(',')}`);
      return NextResponse.json({ prices }, { status: 200 });
    }

    const data = await res.json() as Record<string, { brl?: number }>;
    for (const [id, quote] of Object.entries(data)) {
      const price = quote?.brl;
      const ticker = CRYPTO_ID_TO_TICKER[id];
      if (ticker && price != null && !isNaN(price)) {
        prices[ticker] = price;
      }
    }
  } catch (e) {
    console.error(`[quotes-crypto] CoinGecko falhou: ${e instanceof Error ? e.message : 'erro de rede'}`);
  }

  return NextResponse.json({ prices });
}
