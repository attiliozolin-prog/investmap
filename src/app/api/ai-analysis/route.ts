import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY não configurada. Adicione ao arquivo .env.local e reinicie o servidor.' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const {
    strategyName,
    healthScore,
    totalProfitLossPercent,
    needsRebalancing,
    categories,
    assets,
  } = body as {
    strategyName: string;
    healthScore: number;
    totalInvested: number;
    totalCurrent: number;
    totalProfitLossPercent: number;
    needsRebalancing: boolean;
    categories: { class: string; subclass: string; targetPercent: number; currentPercent: number; action: string; rebalanceAmount: number }[];
    assets: { ticker: string; subclass: string; profitLossPercent: number; currentPortfolioPercent: number; targetPercent: number; action: string }[];
  };

  const prompt = `
Você é um educador financeiro especialista em investimentos no mercado brasileiro. Analise a carteira de investimentos abaixo e forneça uma análise qualitativa clara, objetiva e educativa em português do Brasil.

## Dados da Carteira: ${strategyName}

**Health Score:** ${healthScore.toFixed(0)}/100
**Retorno total:** ${totalProfitLossPercent >= 0 ? '+' : ''}${totalProfitLossPercent.toFixed(2)}%
**Rebalanceamento necessário:** ${needsRebalancing ? 'Sim' : 'Não'}

**Alocação por Subclasse:**
${categories.map(c => `- ${c.class} / ${c.subclass}: atual ${c.currentPercent.toFixed(1)}% vs alvo ${c.targetPercent}% → ${c.action === 'buy' ? 'COMPRAR' : c.action === 'sell' ? 'VENDER/REDUZIR' : 'OK'}`).join('\n')}

**Ativos Individuais:**
${assets.map(a => `- ${a.ticker} (${a.subclass}): ${a.currentPortfolioPercent.toFixed(1)}% da carteira, alvo ${a.targetPercent}%, retorno ${a.profitLossPercent >= 0 ? '+' : ''}${a.profitLossPercent.toFixed(1)}% → ${a.action.toUpperCase()}`).join('\n')}

## Sua análise deve:
1. Avaliar o nível de diversificação da carteira
2. Comentar sobre os maiores desvios em relação à estratégia
3. Destacar pontos positivos e pontos de atenção
4. Dar orientações gerais de educação financeira baseadas nos dados
5. NÃO recomendar ativos específicos para compra
6. Usar linguagem acessível, como se estivesse explicando para alguém que está aprendendo a investir
7. Ser conciso: máximo 300 palavras

Formate com seções usando ## e bullets com -.
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um educador financeiro especialista em investimentos no Brasil. Nunca recomende ativos específicos. Sempre inclua linguagem de isenção de responsabilidade.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 600,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = (errData as { error?: { message?: string } })?.error?.message ?? `HTTP ${response.status}`;
      return NextResponse.json({ error: `Erro na OpenAI: ${msg}` }, { status: 502 });
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
    };
    const analysis = data.choices?.[0]?.message?.content ?? '';

    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
