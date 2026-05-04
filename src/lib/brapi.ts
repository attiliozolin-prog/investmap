export async function fetchAssetPrice(ticker: string): Promise<number | null> {
  if (!ticker) return null;
  // Limpa o ticker (remove F de fracionário se houver)
  const cleanTicker = ticker.toUpperCase().replace(/F$/, '');
  
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${cleanTicker}?token=COLOQUE_SEU_TOKEN_AQUI`);
    // Nota: A Brapi requer um token gratuito agora, mas para algumas chamadas funciona sem.
    // Para contornar limites sem token, podemos usar a rota gratuita básica ou o token se o usuário adicionar.
    // Vamos tentar sem token primeiro. (A URL base costuma ser apenas https://brapi.dev/api/quote/PETR4)
    if (!res.ok) {
      // Tenta de novo sem token caso o endpoint mude
      const res2 = await fetch(`https://brapi.dev/api/quote/${cleanTicker}`);
      if (!res2.ok) return null;
      const data = await res2.json();
      return data.results?.[0]?.regularMarketPrice || null;
    }
    const data = await res.json();
    return data.results?.[0]?.regularMarketPrice || null;
  } catch (error) {
    console.error("Erro ao buscar preço na Brapi:", error);
    return null;
  }
}
