const BRAPI_TOKEN = process.env.NEXT_PUBLIC_BRAPI_TOKEN ?? '';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const CHUNK_SIZE = 10; // Conservador para o plano gratuito

// -----------------------------------------------
// Cache local
// -----------------------------------------------
function getCached(ticker: string): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`brapi_price_${ticker}`);
    if (!raw) return null;
    const { price, ts } = JSON.parse(raw) as { price: number; ts: number };
    if (Date.now() - ts < CACHE_TTL_MS) return price;
  } catch { /* ignore */ }
  return null;
}

function setCache(ticker: string, price: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`brapi_price_${ticker}`, JSON.stringify({ price, ts: Date.now() }));
  } catch { /* ignore */ }
}

// -----------------------------------------------
// Heurística: detecta se o ticker é elegível para
// busca automática (ações B3, FIIs, ETFs, BDRs, Cripto)
// -----------------------------------------------
export function detectPriceMode(ticker: string): 'auto' | 'manual' {
  const clean = ticker.trim().toUpperCase();
  /*
    Tickers B3 SEMPRE terminam com pelo menos 1 dígito:
      Ações:  PETR4, VALE3, ITUB4
      FIIs:   HGLG11, MXRF11
      ETFs:   BOVA11, IVVB11
      BDRs:   AAPL34, AMZO34

    Criptomoedas são letras puras, SEM dígito final:
      BTC, ETH, SOL, DOT, ADA → manual

    A regex antiga usava [0-9]{0,2} (0 a 2 dígitos), classificando
    criptos incorretamente como 'auto'.
  */
  return /^[A-Z]{2,6}\d{1,2}$/.test(clean) ? 'auto' : 'manual';
}


// -----------------------------------------------
// Busca preço de UM ativo (uso no modal - botão Auto)
// -----------------------------------------------
export async function fetchAssetPrice(ticker: string): Promise<number | null> {
  if (!ticker) return null;
  const cleanTicker = ticker.toUpperCase().replace(/F$/, '');

  const cached = getCached(cleanTicker);
  if (cached !== null) return cached;

  const tokenParam = BRAPI_TOKEN ? `?token=${BRAPI_TOKEN}` : '';

  try {
    const res = await fetch(`https://brapi.dev/api/quote/${cleanTicker}${tokenParam}`);
    if (!res.ok) return null;
    const data = await res.json();
    const price: number | null = data.results?.[0]?.regularMarketPrice ?? null;
    if (price !== null) setCache(cleanTicker, price);
    return price;
  } catch (error) {
    console.error('Erro ao buscar preço na Brapi:', error);
    return null;
  }
}

// -----------------------------------------------
// Busca preços de MÚLTIPLOS ativos em batch
// Retorna Map<ticker, price>
// -----------------------------------------------
export async function fetchAssetPrices(tickers: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!tickers.length) return result;

  // Deduplica e limpa tickers
  const cleanTickers = Array.from(new Set(tickers.map(t => t.toUpperCase().replace(/F$/, ''))));

  // Divide em chunks de CHUNK_SIZE
  const chunks: string[][] = [];
  for (let i = 0; i < cleanTickers.length; i += CHUNK_SIZE) {
    chunks.push(cleanTickers.slice(i, i + CHUNK_SIZE));
  }

  const tokenParam = BRAPI_TOKEN ? `?token=${BRAPI_TOKEN}` : '';

  for (const chunk of chunks) {
    // Verifica cache antes de chamar a API
    const uncached: string[] = [];
    for (const ticker of chunk) {
      const cached = getCached(ticker);
      if (cached !== null) {
        result.set(ticker, cached);
      } else {
        uncached.push(ticker);
      }
    }

    if (uncached.length === 0) continue;

    try {
      const tickerParam = uncached.join(',');
      const res = await fetch(
        `https://brapi.dev/api/quote/${tickerParam}${tokenParam}`
      );
      if (!res.ok) continue;
      const data = await res.json();

      for (const item of data.results ?? []) {
        const price: number = item.regularMarketPrice;
        if (price != null && !isNaN(price)) {
          result.set(item.symbol as string, price);
          setCache(item.symbol as string, price);
        }
      }
    } catch (e) {
      console.error('Brapi batch fetch error:', e);
    }
  }

  return result;
}
