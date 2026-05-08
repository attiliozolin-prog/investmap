import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PortfolioContext {
  strategyName: string;
  healthScore: number;
  totalProfitLossPercent: number;
  needsRebalancing: boolean;
  categories: {
    class: string;
    subclass: string;
    targetPercent: number;
    currentPercent: number;
    action: string;
  }[];
  assets: {
    ticker: string;
    subclass: string;
    profitLossPercent: number;
    currentPortfolioPercent: number;
    targetPercent: number;
    action: string;
  }[];
}

const SYSTEM_PROMPT = `Você é o "Assistente InvestMap", um educador financeiro especializado no mercado brasileiro.

## Suas regras absolutas:
1. NUNCA recomende comprar ou vender ativos específicos (ações, FIIs, ETFs, títulos, etc.)
2. NUNCA faça previsões de preço ou rentabilidade futura
3. SEMPRE que o usuário pedir uma recomendação direta, explique que você não pode fazê-la por ser um assistente educacional
4. SEMPRE encoraje o usuário a consultar um assessor de investimentos habilitado para decisões importantes
5. Mantenha linguagem acessível, objetiva e profissional
6. Pode e deve usar os dados da carteira do usuário para contextualizar suas respostas educacionais
7. Use Markdown para formatar suas respostas (negrito, listas, cabeçalhos)
8. Seja conciso — respostas de no máximo 400 palavras, exceto quando o assunto exigir mais detalhes

## O que você PODE fazer:
- Explicar conceitos de finanças pessoais e investimentos
- Explicar como funcionam diferentes tipos de ativos (ações, FIIs, renda fixa, ETFs, etc.)
- Comentar sobre a alocação atual da carteira do usuário de forma educacional
- Explicar indicadores como P/L, dividend yield, índice Sharpe, etc.
- Explicar como funciona o IR sobre investimentos no Brasil
- Ajudar o usuário a entender o conceito de rebalanceamento e diversificação
- Responder perguntas sobre estratégias de investimento em termos conceituais

## Isenção de responsabilidade:
Esta é uma ferramenta educacional. Nenhuma informação fornecida constitui recomendação de investimento. Decisões de investimento envolvem riscos e devem ser tomadas com auxílio de um profissional habilitado pela CVM.`;

function buildPortfolioContextText(ctx: PortfolioContext): string {
  return `
## Contexto da Carteira do Usuário (use para contextualizar suas respostas):
- **Nome da carteira:** ${ctx.strategyName}
- **Nota de saúde:** ${ctx.healthScore.toFixed(0)}/100
- **Retorno total:** ${ctx.totalProfitLossPercent >= 0 ? '+' : ''}${ctx.totalProfitLossPercent.toFixed(2)}%
- **Precisa de rebalanceamento:** ${ctx.needsRebalancing ? 'Sim' : 'Não'}

**Alocação por categoria:**
${ctx.categories.map(c => `- ${c.class} / ${c.subclass}: atual ${c.currentPercent.toFixed(1)}% vs alvo ${c.targetPercent}%`).join('\n')}

**Ativos na carteira:**
${ctx.assets.map(a => `- ${a.ticker} (${a.subclass}): ${a.currentPortfolioPercent.toFixed(1)}% do portfólio, retorno ${a.profitLossPercent >= 0 ? '+' : ''}${a.profitLossPercent.toFixed(1)}%`).join('\n')}
`.trim();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY não configurada. Adicione ao arquivo .env.local e reinicie o servidor.' },
      { status: 500 }
    );
  }

  let body: { messages: ChatMessage[]; portfolioContext?: PortfolioContext };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const { messages, portfolioContext } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Nenhuma mensagem fornecida.' }, { status: 400 });
  }

  // Monta o system prompt com ou sem contexto de carteira
  const systemContent = portfolioContext
    ? `${SYSTEM_PROMPT}\n\n${buildPortfolioContextText(portfolioContext)}`
    : SYSTEM_PROMPT;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemContent },
          ...messages,
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg =
        (errData as { error?: { message?: string } })?.error?.message ??
        `HTTP ${response.status}`;
      return NextResponse.json({ error: `Erro na OpenAI: ${msg}` }, { status: 502 });
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const reply = data.choices?.[0]?.message?.content ?? '';

    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
