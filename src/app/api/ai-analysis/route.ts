import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rateLimit';
import { OPENAI_MODEL, OPENAI_CHAT_COMPLETIONS_URL } from '@/lib/aiConfig';

// Limite: 10 análises por usuário a cada 24h
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Sanitização: o body vem do client e é interpolado no prompt
const str = (v: unknown, max = 60): string =>
  typeof v === 'string' ? v.slice(0, max) : '';
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function POST(req: NextRequest) {
  // ── Autenticação primeiro: anônimo não sonda nem a configuração ──
  const supabase = createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Não autenticado. Faça login para usar a análise IA.' },
      { status: 401 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY não configurada. Adicione ao arquivo .env.local e reinicie o servidor.' },
      { status: 500 }
    );
  }

  // ── Rate limit por usuário ──
  const limit = checkRateLimit(user.id, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Limite de ${RATE_LIMIT_MAX} análises por dia atingido. Tente novamente em ${Math.ceil(limit.retryAfterSeconds / 3600)}h.` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  const strategyName = str(raw.strategyName);
  const healthScore = num(raw.healthScore);
  const totalProfitLossPercent = num(raw.totalProfitLossPercent);
  const needsRebalancing = Boolean(raw.needsRebalancing);

  // Contexto quantitativo opcional (plano de aporte, IR estimado, concentração)
  const rawPlan = raw.contributionPlan as Record<string, unknown> | null | undefined;
  const planTotal = rawPlan ? num(rawPlan.total) : 0;
  const planItems = rawPlan && Array.isArray(rawPlan.items)
    ? rawPlan.items.slice(0, 5).map(i => {
        const it = i as Record<string, unknown>;
        return { subclass: str(it.subclass), amount: num(it.amount) };
      }).filter(i => i.amount > 0)
    : [];
  const estimatedSellTax = num(raw.estimatedSellTax);
  const rawConc = raw.topConcentration as Record<string, unknown> | null | undefined;
  const topConcentration = rawConc
    ? { ticker: str(rawConc.ticker, 12), percent: num(rawConc.percent) }
    : null;
  const categories = (Array.isArray(raw.categories) ? raw.categories : [])
    .slice(0, 30)
    .map(c => {
      const cat = c as Record<string, unknown>;
      return {
        class: str(cat.class),
        subclass: str(cat.subclass),
        targetPercent: num(cat.targetPercent),
        currentPercent: num(cat.currentPercent),
      };
    });

  const prompt = `
Você é um educador financeiro experiente, paciente e muito empático, especializado em ajudar investidores iniciantes no Brasil a organizarem suas carteiras.
Sua missão é olhar os dados da carteira abaixo e escrever uma análise curta, encorajadora e fácil de entender.

## Dados da Carteira: ${strategyName}
- Saúde Financeira (nota gerada pelo app): ${healthScore.toFixed(0)}/100
- Retorno Total: ${totalProfitLossPercent >= 0 ? '+' : ''}${totalProfitLossPercent.toFixed(2)}%
- Precisa de rebalanceamento urgente? ${needsRebalancing ? 'Sim' : 'Não'}

**Categorias Atuais vs Alvos:**
${categories.map(c => `- ${c.class} / ${c.subclass}: Você tem ${c.currentPercent.toFixed(1)}%, mas o plano era ${c.targetPercent}%`).join('\n')}
${planTotal > 0 ? `
**Plano de correção já calculado pelo app (aporte, sem vender nada):**
- Total: R$ ${planTotal.toFixed(0)}
${planItems.map(i => `- R$ ${i.amount.toFixed(0)} em ${i.subclass}`).join('\n')}
` : ''}${estimatedSellTax > 0 ? `- Atenção: corrigir VENDENDO os ativos acima do alvo geraria ~R$ ${estimatedSellTax.toFixed(0)} de imposto de renda; corrigir via aporte evita esse custo.
` : ''}${topConcentration && topConcentration.percent >= 15 ? `- Maior posição individual: ${topConcentration.ticker} com ${topConcentration.percent.toFixed(1)}% da carteira.
` : ''}
## Diretrizes para a sua resposta:
1. Comece de forma direta, avaliando o nível de saúde financeira da carteira e o retorno total.
2. Faça um diagnóstico focado em **equilíbrio e diversificação**. Seja direto sobre concentrações excessivas e riscos atrelados a elas.
3. Se houver desvios grandes (ex: Renda Variável Exterior muito acima do alvo), explique brevemente o porquê de ser um risco, ressaltando a importância do rebalanceamento.
4. Forneça **bullet points precisos e diretos** com os pontos de atenção e onde agir. Quando houver "Plano de correção já calculado pelo app", comente esse plano concreto (por que corrigir via aporte é melhor que vender, especialmente se houver custo de IR estimado) em vez de sugestões genéricas.
5. Regra de Ouro: **NUNCA** recomende compra ou venda de ações ou ativos diretamente.
6. A linguagem deve ser profissional, objetiva e fácil de entender para um iniciante, sem analogias exageradas.
7. Use Markdown (**negrito** para destacar termos importantes, "##" para cabeçalhos e "-" para listas estruturadas). Evite blocos de texto muito longos.
`;

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
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
