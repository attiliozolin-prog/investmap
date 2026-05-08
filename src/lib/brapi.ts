const BRAPI_TOKEN = process.env.NEXT_PUBLIC_BRAPI_TOKEN ?? '';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

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

export async function fetchAssetPrice(ticker: string): Promise<number | null> {
  if (!ticker) return null;
  // Limpa o ticker (remove F de fracionário se houver)
  const cleanTicker = ticker.toUpperCase().replace(/F$/, '');

  // Verifica cache antes de chamar a API
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
