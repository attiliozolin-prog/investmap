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
    totalValue: number;
    totalProfitLossPercent: number;
    needsRebalancing: boolean;
    categories: { class: string; subclass: string; targetPercent: number; currentPercent: number; action: string; rebalanceAmount: number }[];
    assets: { ticker: string; subclass: string; profitLossPercent: number; currentPortfolioPercent: number; targetPercent: number; action: string }[];
  };

  const prompt = `
Você é um educador financeiro experiente, paciente e muito empático, especializado em ajudar investidores iniciantes no Brasil a organizarem suas carteiras.
Sua missão é olhar os dados da carteira abaixo e escrever uma análise curta, encorajadora e fácil de entender. 

## Dados da Carteira: ${strategyName}
- Saúde Financeira (nota gerada pelo app): ${healthScore.toFixed(0)}/100
- Retorno Total: ${totalProfitLossPercent >= 0 ? '+' : ''}${totalProfitLossPercent.toFixed(2)}%
- Precisa de rebalanceamento urgente? ${needsRebalancing ? 'Sim' : 'Não'}

**Categorias Atuais vs Alvos:**
${categories.map(c => `- ${c.class} / ${c.subclass}: Você tem ${c.currentPercent.toFixed(1)}%, mas o plano era ${c.targetPercent}%`).join('\n')}

## Diretrizes para a sua resposta:
1. Comece de forma direta, avaliando o nível de saúde financeira da carteira e o retorno total.
2. Faça um diagnóstico focado em **equilíbrio e diversificação**. Seja direto sobre concentrações excessivas e riscos atrelados a elas.
3. Se houver desvios grandes (ex: Renda Variável Exterior muito acima do alvo), explique brevemente o porquê de ser um risco, ressaltando a importância do rebalanceamento.
4. Forneça **bullet points precisos e diretos** com os pontos de atenção e onde agir.
5. Regra de Ouro: **NUNCA** recomende compra ou venda de ações ou ativos diretamente.
6. A linguagem deve ser profissional, objetiva e fácil de entender para um iniciante, sem analogias exageradas.
7. Use Markdown (**negrito** para destacar termos importantes, "##" para cabeçalhos e "-" para listas estruturadas). Evite blocos de texto muito longos.
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
