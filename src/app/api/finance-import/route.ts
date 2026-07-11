import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';
import { createServerSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rateLimit';
import { OPENAI_MODEL, OPENAI_CHAT_COMPLETIONS_URL } from '@/lib/aiConfig';
import { fallbackCategory, isUselessCategory } from '@/lib/importCategoryRules';
import type { AiImportItem, AiImportResult, AiImportDocumentType } from '@/types';

// Fatura grande = muitos tokens de saída = minutos. Requer Fluid Compute
// ativado no projeto Vercel (Settings → Functions) — sem ele o plano Hobby
// limita a 60s e o deploy com este valor falha.
export const maxDuration = 300;

// Limite próprio (não divide a janela com a análise de carteira):
// ler documento custa mais tokens, mas o usuário importa no máximo
// algumas faturas/notas por dia.
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

// ~3,3 MB de arquivo (base64 infla ~33%) — folga sob o teto de 4,5 MB
// de body da Vercel. O client já comprime imagens antes de enviar.
const MAX_BASE64_CHARS = 4_500_000;
// Fatura real chega a >150 compras; com maxDuration de 300s cabe com folga
const MAX_ITEMS = 300;

// PDFs digitais (faturas de banco) têm texto embutido: extraí-lo e mandar só
// texto é ordens de grandeza mais rápido que visão sobre cada página — uma
// fatura de 11 páginas estourava o tempo da função (504). Abaixo deste mínimo
// de texto, tratamos como PDF escaneado e caímos no caminho de visão.
const MIN_PDF_TEXT_CHARS = 200;
const MAX_PDF_TEXT_CHARS = 60_000;

const DOC_TYPES: AiImportDocumentType[] = ['fatura_cartao', 'extrato', 'cupom', 'recibo', 'boleto', 'outro'];

// Tempo é o recurso escasso: a função da Vercel morre em 60s (plano Hobby)
// e o que domina a latência é a GERAÇÃO de tokens. Por isso os itens usam
// chaves de 1-2 letras e categoria como índice numérico — uma fatura de
// ~100 itens cai de ~3.500 para ~1.800 tokens de saída, metade do tempo.
//
// Structured Outputs (strict) garante JSON válido no formato exato; a
// validação de conteúdo (valores, datas, índice de categoria) é server-side.
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
          required: ['d', 'v', 'dt', 'c', 't'],
          properties: {
            d: { type: 'string', description: 'descrição curta' },
            v: { type: 'number', description: 'valor em reais' },
            dt: { type: ['string', 'null'], description: 'data YYYY-MM-DD ou null' },
            c: { type: ['integer', 'null'], description: 'índice da categoria na lista numerada, ou null' },
            t: { type: 'string', enum: ['e', 'i'], description: 'e=gasto, i=receita' },
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

  const rawItems = Array.isArray(r?.items) ? r.items : [];
  const items = rawItems
    .slice(0, MAX_ITEMS)
    .map((it): AiImportItem | null => {
      const item = it as Record<string, unknown>;
      const description = typeof item?.d === 'string' ? item.d.trim().slice(0, 120) : '';
      const value = Math.round(Number(item?.v) * 100) / 100;
      if (!description || !Number.isFinite(value) || value <= 0) return null;

      const date = typeof item?.dt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.dt) && !isNaN(Date.parse(item.dt))
        ? item.dt : null;
      const catIdx = Number(item?.c);
      let category = Number.isInteger(catIdx) && catIdx >= 0 && catIdx < allowedCategories.length
        ? allowedCategories[catIdx] : null;
      // Sem categoria (ou no genérico "Outro")? Tenta as regras de estabelecimento
      if (isUselessCategory(category)) {
        category = fallbackCategory(description, allowedCategories) ?? category;
      }
      const type = item?.t === 'i' ? 'income' as const : 'expense' as const;
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
    truncated: rawItems.length > MAX_ITEMS,
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

Cada compra/cobrança/receita vira um item com os campos:
- d: descrição curta e limpa (nome do estabelecimento ou serviço, sem códigos internos, no máximo ~5 palavras). Compra parcelada: parcela no fim, ex. "Magazine Luiza (3/10)".
- v: valor em reais, sempre positivo, com centavos.
- dt: data do item no formato YYYY-MM-DD; null se o documento não mostrar.
- c: índice numérico da categoria que melhor descreve o item, escolhido desta lista, ou null se nenhuma servir: ${categories.map((c, i) => `${i}=${c}`).join(' ') || '(nenhuma categoria — use null)'}.
  Use o ramo do estabelecimento para categorizar: apps de transporte (Uber, 99), postos e estacionamentos → transporte; delivery, restaurantes e mercados → alimentação; pet shops (Cobasi, Petz, Petlove, ração) → pets; farmácias e clínicas → saúde; salão, barbearia, perfumaria, O Boticário, Natura → beleza; lojas de casa e utilidades do lar (Leroy Merlin, Havan, IKEA, Tok&Stok) → casa; lojas de roupas e calçados (Renner, Riachuelo, Zara, Nike, Adidas) → vestuário; streaming e jogos → lazer; marketplaces genéricos que vendem de tudo (Mercado Livre, Amazon, AliExpress, Temu, Shopee, Magazine Luiza, Americanas) → compras online. Prefira sempre uma categoria específica a "Outro".
- t: "e" para gastos e cobranças; "i" somente para valores recebidos pelo usuário (salário, reembolso, transferência recebida).

Regras:
- Em fatura de cartão: ignore linhas de pagamento da fatura anterior, créditos e estornos. Encargos e juros cobrados são itens normais.
- Não crie itens para subtotais nem para o total — informe o total do documento apenas em totalDetected.
- referenceMonth: mês de referência do documento (YYYY-MM) ou null.
- Se o documento estiver ilegível ou não for um documento financeiro, retorne items: [] e documentType: "outro".
`.trim();

  // Conteúdo enviado ao modelo: texto extraído (PDF digital — rápido),
  // ou o arquivo em si (imagem/PDF escaneado — visão, mais lento).
  let userContent: unknown[];
  if (mimeType === 'application/pdf') {
    let pdfText = '';
    try {
      const bytes = new Uint8Array(Buffer.from(fileBase64, 'base64'));
      const { text } = await extractText(bytes, { mergePages: true });
      pdfText = (text ?? '').trim();
    } catch {
      pdfText = ''; // PDF ilegível pela extração → tenta visão
    }

    userContent = pdfText.length >= MIN_PDF_TEXT_CHARS
      ? [{ type: 'text', text: `${instructions}\n\nCONTEÚDO DO DOCUMENTO (texto extraído do PDF):\n${pdfText.slice(0, MAX_PDF_TEXT_CHARS)}` }]
      : [
          { type: 'text', text: instructions },
          { type: 'file', file: { filename: 'documento.pdf', file_data: `data:application/pdf;base64,${fileBase64}` } },
        ];
  } else {
    userContent = [
      { type: 'text', text: instructions },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}`, detail: 'high' } },
    ];
  }

  // Aborta antes de a Vercel matar a função (maxDuration 300s), para o
  // usuário receber uma mensagem acionável em vez de um 504 opaco.
  const abort = new AbortController();
  const abortTimer = setTimeout(() => abort.abort(), 280_000);
  const t0 = Date.now();

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      signal: abort.signal,
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
            content: userContent,
          },
        ],
        response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
        // Fatura grande pode ter ~300 itens; truncar aqui quebraria o JSON
        max_tokens: 12288,
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

    const result = sanitizeResult(parsed, categories);
    // Telemetria nos logs da Vercel para diagnosticar latência em produção
    console.log(`[finance-import] ok em ${Date.now() - t0}ms · ${mimeType} · ${result.items.length} itens`);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[finance-import] abortado após ${Date.now() - t0}ms · ${mimeType}`);
      return NextResponse.json(
        { error: 'O documento é muito longo para o tempo disponível. Tente enviar só as páginas com os lançamentos, ou uma foto por página.' },
        { status: 504 }
      );
    }
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    console.error(`[finance-import] erro após ${Date.now() - t0}ms:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    clearTimeout(abortTimer);
  }
}
