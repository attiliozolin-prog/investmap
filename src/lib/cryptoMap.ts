// -----------------------------------------------
// Mapa ticker → id do CoinGecko.
// A API do CoinGecko identifica moedas por "id" (ex.: "bitcoin"),
// não pelo símbolo (ex.: "BTC"). Este mapa faz a tradução nas duas
// pontas (client e route handler compartilham este módulo puro).
//
// Para adicionar uma moeda: pegue o "id" na resposta de
// https://api.coingecko.com/api/v3/coins/list e inclua aqui.
// -----------------------------------------------
export const CRYPTO_TICKER_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  BNB: 'binancecoin',
  SOL: 'solana',
  USDC: 'usd-coin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TRX: 'tron',
  AVAX: 'avalanche-2',
  SHIB: 'shiba-inu',
  DOT: 'polkadot',
  LINK: 'chainlink',
  BCH: 'bitcoin-cash',
  MATIC: 'matic-network',
  LTC: 'litecoin',
  UNI: 'uniswap',
  ICP: 'internet-computer',
  ETC: 'ethereum-classic',
  APT: 'aptos',
  XLM: 'stellar',
  ATOM: 'cosmos',
  FIL: 'filecoin',
  HBAR: 'hedera-hashgraph',
  ARB: 'arbitrum',
  VET: 'vechain',
  NEAR: 'near',
  OP: 'optimism',
  INJ: 'injective-protocol',
  AAVE: 'aave',
  GRT: 'the-graph',
  ALGO: 'algorand',
  SUI: 'sui',
  RNDR: 'render-token',
  MKR: 'maker',
  IMX: 'immutable-x',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS: 'axie-infinity',
  XTZ: 'tezos',
  EOS: 'eos',
  FLOW: 'flow',
  CRV: 'curve-dao-token',
  CAKE: 'pancakeswap-token',
};

// id do CoinGecko → ticker (para traduzir a resposta de volta)
export const CRYPTO_ID_TO_TICKER: Record<string, string> = Object.fromEntries(
  Object.entries(CRYPTO_TICKER_TO_ID).map(([ticker, id]) => [id, ticker])
);

export function isCryptoTicker(ticker: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    CRYPTO_TICKER_TO_ID,
    ticker.trim().toUpperCase()
  );
}

export function tickerToCoinId(ticker: string): string | null {
  return CRYPTO_TICKER_TO_ID[ticker.trim().toUpperCase()] ?? null;
}
