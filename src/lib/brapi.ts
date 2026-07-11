// As cotações passam pelo proxy autenticado /api/quotes —
// o token da Brapi fica no servidor, fora do bundle do client.
import { isCryptoTicker } from './cryptoMap';
import { fetchCryptoPrice, fetchCryptoPrices } from './coingecko';

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos

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

/**
 * Invalida o cache de um ou todos os tickers para forçar
 * uma busca fresca na próxima chamada.
 */
export function clearPriceCache(tickers?: string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (tickers) {
      tickers.forEach(t => localStorage.removeItem(`brapi_price_${t.toUpperCase()}`));
    } else {
      // Remove todas as entradas brapi_price_*
      Object.keys(localStorage)
        .filter(k => k.startsWith('brapi_price_'))
        .forEach(k => localStorage.removeItem(k));
    }
  } catch { /* ignore */ }
}

// -----------------------------------------------
// Heurística: detecta a FONTE de cotação de um ticker.
//
//   Tickers B3 SEMPRE terminam com pelo menos 1 dígito → Brapi:
//     Ações PETR4 · FIIs HGLG11 · ETFs IVVB11 · BDRs AAPL34
//   Criptomoedas são letras puras, SEM dígito final → CoinGecko:
//     BTC, ETH, SOL … (apenas as reconhecidas em cryptoMap; letras
//     puras fora do mapa não são resolvíveis para um id).
//
// Retorna null quando nenhuma fonte reconhece o ticker (→ modo manual).
// -----------------------------------------------
export function detectPriceSource(ticker: string): 'brapi' | 'coingecko' | null {
  const clean = ticker.trim().toUpperCase();
  if (/^[A-Z]{2,6}\d{1,2}$/.test(clean)) return 'brapi';
  if (isCryptoTicker(clean)) return 'coingecko';
  return null;
}

export function detectPriceMode(ticker: string): 'auto' | 'manual' {
  return detectPriceSource(ticker) ? 'auto' : 'manual';
}


// -----------------------------------------------
// Busca preço de UM ativo (uso no modal - botão Auto)
// -----------------------------------------------
export async function fetchAssetPrice(ticker: string): Promise<number | null> {
  if (!ticker) return null;

  // Cripto vai para o CoinGecko; ações/FIIs/etc. seguem pela Brapi.
  if (isCryptoTicker(ticker)) return fetchCryptoPrice(ticker);

  const cleanTicker = ticker.toUpperCase().replace(/F$/, '');

  const cached = getCached(cleanTicker);
  if (cached !== null) return cached;

  try {
    const res = await fetch(`/api/quotes?tickers=${encodeURIComponent(cleanTicker)}`);
    if (!res.ok) return null;
    const data = await res.json() as { prices?: Record<string, number> };
    const price = data.prices?.[cleanTicker] ?? null;
    if (price !== null) setCache(cleanTicker, price);
    return price;
  } catch (error) {
    console.error('Erro ao buscar preço:', error);
    return null;
  }
}

// -----------------------------------------------
// Busca preços de MÚLTIPLOS ativos em batch
// Retorna Map<ticker, price>
// -----------------------------------------------
export async function fetchAssetPrices(tickers: string[], forceRefresh = false): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!tickers.length) return result;

  // Separa cripto (CoinGecko) das demais (Brapi). Cripto é buscada em
  // paralelo pelo wrapper próprio e mesclada no resultado; note que o
  // strip de "F" final (fracionário B3) NÃO se aplica a cripto.
  const cryptoTickers = tickers.filter(isCryptoTicker);
  const b3Raw = tickers.filter(t => !isCryptoTicker(t));

  const cryptoPromise = cryptoTickers.length
    ? fetchCryptoPrices(cryptoTickers, forceRefresh)
    : Promise.resolve(new Map<string, number>());

  // Deduplica e limpa tickers B3
  const cleanTickers = Array.from(new Set(b3Raw.map(t => t.toUpperCase().replace(/F$/, ''))));

  // Se forceRefresh, invalida o cache para esses tickers
  if (forceRefresh) clearPriceCache(cleanTickers);

  // Resolve o que der pelo cache local; o resto vai em uma chamada só
  // (o chunking para a Brapi acontece no servidor)
  const uncached: string[] = [];
  for (const ticker of cleanTickers) {
    const cached = getCached(ticker);
    if (cached !== null) {
      result.set(ticker, cached);
    } else {
      uncached.push(ticker);
    }
  }

  if (uncached.length > 0) {
    try {
      const res = await fetch(`/api/quotes?tickers=${encodeURIComponent(uncached.join(','))}`);
      if (res.ok) {
        const data = await res.json() as { prices?: Record<string, number> };
        for (const [symbol, price] of Object.entries(data.prices ?? {})) {
          if (price != null && !isNaN(price)) {
            result.set(symbol, price);
            setCache(symbol, price);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao buscar preços em batch:', e);
    }
  }

  // Mescla as cotações de cripto (buscadas em paralelo desde o início).
  const cryptoPrices = await cryptoPromise;
  cryptoPrices.forEach((price, symbol) => result.set(symbol, price));

  return result;
}
