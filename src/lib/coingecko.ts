// Cotações de cripto passam pelo proxy autenticado /api/quotes-crypto.
// O endpoint público do CoinGecko não exige key; o proxy existe para
// login, rate-limit e cache compartilhado — ver o route handler.
import { isCryptoTicker } from './cryptoMap';

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos (igual à Brapi)

// -----------------------------------------------
// Cache local (prefixo próprio para não colidir com brapi_price_*)
// -----------------------------------------------
function getCached(ticker: string): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`coingecko_price_${ticker}`);
    if (!raw) return null;
    const { price, ts } = JSON.parse(raw) as { price: number; ts: number };
    if (Date.now() - ts < CACHE_TTL_MS) return price;
  } catch { /* ignore */ }
  return null;
}

function setCache(ticker: string, price: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`coingecko_price_${ticker}`, JSON.stringify({ price, ts: Date.now() }));
  } catch { /* ignore */ }
}

export function clearCryptoPriceCache(tickers?: string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (tickers) {
      tickers.forEach(t => localStorage.removeItem(`coingecko_price_${t.toUpperCase()}`));
    } else {
      Object.keys(localStorage)
        .filter(k => k.startsWith('coingecko_price_'))
        .forEach(k => localStorage.removeItem(k));
    }
  } catch { /* ignore */ }
}

// -----------------------------------------------
// Busca preço de UMA cripto (uso no modal - botão Auto)
// -----------------------------------------------
export async function fetchCryptoPrice(ticker: string): Promise<number | null> {
  const clean = ticker.trim().toUpperCase();
  if (!isCryptoTicker(clean)) return null;

  const cached = getCached(clean);
  if (cached !== null) return cached;

  try {
    const res = await fetch(`/api/quotes-crypto?tickers=${encodeURIComponent(clean)}`);
    if (!res.ok) return null;
    const data = await res.json() as { prices?: Record<string, number> };
    const price = data.prices?.[clean] ?? null;
    if (price !== null) setCache(clean, price);
    return price;
  } catch (error) {
    console.error('Erro ao buscar preço de cripto:', error);
    return null;
  }
}

// -----------------------------------------------
// Busca preços de MÚLTIPLAS criptos em batch.
// Retorna Map<ticker, price>.
// -----------------------------------------------
export async function fetchCryptoPrices(tickers: string[], forceRefresh = false): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!tickers.length) return result;

  const cleanTickers = Array.from(new Set(
    tickers.map(t => t.trim().toUpperCase()).filter(isCryptoTicker)
  ));
  if (!cleanTickers.length) return result;

  if (forceRefresh) clearCryptoPriceCache(cleanTickers);

  const uncached: string[] = [];
  for (const ticker of cleanTickers) {
    const cached = getCached(ticker);
    if (cached !== null) {
      result.set(ticker, cached);
    } else {
      uncached.push(ticker);
    }
  }

  if (uncached.length === 0) return result;

  try {
    const res = await fetch(`/api/quotes-crypto?tickers=${encodeURIComponent(uncached.join(','))}`);
    if (!res.ok) return result;
    const data = await res.json() as { prices?: Record<string, number> };

    for (const [symbol, price] of Object.entries(data.prices ?? {})) {
      if (price != null && !isNaN(price)) {
        result.set(symbol, price);
        setCache(symbol, price);
      }
    }
  } catch (e) {
    console.error('Erro ao buscar preços de cripto em batch:', e);
  }

  return result;
}
