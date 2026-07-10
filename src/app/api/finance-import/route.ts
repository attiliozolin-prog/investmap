import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rateLimit';
import { OPENAI_MODEL, OPENAI_CHAT_COMPLETIONS_URL } from '@/lib/aiConfig';
import type { AiImportItem, AiImportResult, AiImportDocumentType } from '@/types';

// PDFs multipágina demoram mais que os 10s default da Vercel
export const maxDuration = 60;

// Limite próprio (não divide a janela com a análise de carteira):
// ler documento custa mais tokens, mas o usuário importa no máximo
// algumas faturas/notas por dia.
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

// ~3,3 MB de arquivo (base64 infla ~33%) — folga sob o teto de 4,5 MB
// de body da Vercel. O client já comprime imagens antes de enviar.
const MAX_BASE64_CHARS = 4_500_000;
const MAX_ITEMS = 100;

const DOC_TYPES: AiImportDocumentType[] = ['fatura_cartao', 'extrato', 'cupom', 'recibo', 'boleto', 'outro'];

// Structured Outputs (strict): garante JSON válido no formato exato.
// A categoria é validada server-side contra a lista do usuário (enum
// dinâmico no schema seria possível, mas a validação local é mais robusta).
const RESPONSE_SCHEMA = {
  name: 'lancamentos_extraidos',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['documentType', 'referenceMonth', 'totalDetected', 'items'],
    properties: {
      documentType: { type: 'string', enum: DOC_TYPES },
      referenceMonth: { type: ['string', 'null'], description: 'Mês de referência do documento no formato YYYY-MM' },
      totalDetected: { type: ['number', 'null'], description: 'Valor total do documento (ex.: total da fatura), se impresso nele' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['description', 'value', 'date', 'category', 'type'],
          properties: {
            description: { type: 'string' },
            value: { type: 'number' },
            date: { type: ['string', 'null'], description: 'Data do item no formato YYYY-MM-DD' },
            category: { type: ['string', 'null'] },
            type: { type: 'string', enum: ['expense', 'income'] },
          },
        },
      },
    },
  },
} as const;

const str = (v: unknown, max = 60): string =>
  typeof v === 'string' ? v.slice(0, max) : '';

function sanitizeResult(raw: unknown, allowedCategories: string[]): AiImportResult {
  const r = raw as Record<string, unknown>;
  const catSet = new Set(allowedCategories);

  const items = (Array.isArray(r?.items) ? r.items : [])
    .slice(0, MAX_ITEMS)
    .map((it): AiImportItem | null => {
      const item = it as Record<string, unknown>;
      const description = typeof item?.description === 'string' ? item.description.trim().slice(0, 120) : '';
      const value = Math.round(Number(item?.value) * 100) / 100;
      if (!description || !Number.isFinite(value) || value <= 0) return null;

      const date = typeof item?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && !isNaN(Date.parse(item.date))
        ? item.date : null;
      const category = typeof item?.category === 'string' && catSet.has(item.category) ? item.category : null;
      const type = item?.type === 'income' ? 'income' as const : 'expense' as const;
      return { description, value, date, category, type };
    })
    .filter((it): it is AiImportItem => it !== null);

  const totalRaw = Math.round(Number(r?.totalDetected) * 100) / 100;

  return {
    documentType: DOC_TYPES.includes(r?.documentType as AiImportDocumentType)
      ? r.documentType as AiImportDocumentType : 'outro',
    referenceMonth: typeof r?.referenceMonth === 'string' && /^\d{4}-\d{2}$/.test(r.referenceMonth)
      ? r.referenceMonth : null,
    totalDetected: Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : null,
    items,
  };
}

export async function POST(req: NextRequest) {
  // ── Autenticação primeiro: anônimo não sonda nem a configuração ──
  const supabase = createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Não autenticado. Faça login para importar documentos.' },
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

  const limit = checkRateLimit(`import_${user.id}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Limite de ${RATE_LIMIT_MAX} importações por dia atingido. Tente novamente em ${Math.ceil(limit.retryAfterSeconds / 3600)}h.` },
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

  const mimeType = str(raw.mimeType);
  if (!ACCEPTED_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: 'Formato não suportado. Envie uma foto (JPG, PNG, WebP) ou um PDF.' },
      { status: 400 }
    );
  }

  const fileBase64 = typeof raw.fileBase64 === 'string' ? raw.fileBase64 : '';
  if (!fileBase64) {
    return NextResponse.json({ error: 'Nenhum arquivo recebido.' }, { status: 400 });
  }
  if (fileBase64.length > MAX_BASE64_CHARS) {
    return NextResponse.json(
      { error: 'Arquivo muito grande. O limite é ~3 MB — tente uma foto menor ou um PDF só da fatura.' },
      { status: 413 }
    );
  }

  // Categorias vêm do client e são interpoladas no prompt — sanitizar
  const categories = (Array.isArray(raw.categories) ? raw.categories : [])
    .slice(0, 40)
    .map(c => str(c, 40).trim())
    .filter(Boolean);

  const monthRef = typeof raw.monthRef === 'string' && /^\d{4}-\d{2}$/.test(raw.monthRef) ? raw.monthRef : null;

  const instructions = `
Extraia os lançamentos financeiros deste documento (fatura de cartão, extrato, cupom fiscal, recibo ou boleto).
${monthRef ? `O usuário está organizando o mês ${monthRef}.` : ''}

Regras:
- Cada compra/cobrança/receita vira um item. Descrição curta e limpa (nome do estabelecimento ou serviço, sem códigos internos).
- Valores em reais, sempre positivos, com centavos.
- Compra parcelada: mantenha a parcela no fim da descrição, ex. "Magazine Luiza (3/10)".
- Em fatura de cartão: ignore linhas de pagamento da fatura anterior, créditos e estornos. Encargos e juros cobrados são itens normais.
- Não crie itens para subtotais nem para o total — informe o total do documento apenas em totalDetected.
- date: a data do item no formato YYYY-MM-DD; null se o documento não mostrar.
- type: "expense" para gastos e cobranças; "income" somente para valores recebidos pelo usuário (salário, reembolso, transferência recebida).
- category: escolha EXATAMENTE uma desta lista, copiando a grafia, ou null se nenhuma servir: ${categories.join(' | ') || '(nenhuma categoria cadastrada — use null)'}.
- referenceMonth: mês de referência do documento (YYYY-MM) ou null.
- Se o documento estiver ilegível ou não for um documento financeiro, retorne items: [] e documentType: "outro".
`.trim();

  const filePart = mimeType === 'application/pdf'
    ? { type: 'file', file: { filename: 'documento.pdf', file_data: `data:application/pdf;base64,${fileBase64}` } }
    : { type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}`, detail: 'high' } };

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
          {
            role: 'system',
            content: 'Você é um extrator preciso de dados de documentos financeiros brasileiros. Extraia apenas o que está de fato no documento — nunca invente itens nem valores.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: instructions },
              filePart,
            ],
          },
        ],
        response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
        max_tokens: 4096,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = (errData as { error?: { message?: string } })?.error?.message ?? `HTTP ${response.status}`;
      return NextResponse.json({ error: `Erro na OpenAI: ${msg}` }, { status: 502 });
    }

    const data = await response.json() as {
      choices: { message: { content: string | null; refusal?: string | null } }[];
    };
    const message = data.choices?.[0]?.message;
    if (!message?.content) {
      return NextResponse.json(
        { error: message?.refusal ?? 'A IA não conseguiu processar este documento. Tente outra foto ou PDF.' },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(message.content);
    } catch {
      return NextResponse.json({ error: 'Resposta da IA em formato inesperado. Tente novamente.' }, { status: 502 });
    }

    return NextResponse.json({ result: sanitizeResult(parsed, categories) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
