/**
 * Rede de segurança de categorização da importação por IA.
 *
 * O modelo às vezes deixa estabelecimentos óbvios sem categoria ("Uber Rides"
 * → null/Outro). Estas regras determinísticas cobrem os casos mais comuns no
 * Brasil e SÓ se aplicam quando o modelo não escolheu nada útil. O alvo é
 * resolvido pelo nome da categoria do usuário (normalizado, busca por
 * substring), então a regra só age se ele tiver uma categoria compatível —
 * ex.: a regra de "vestuário/roupa" não faz nada se o usuário não tiver
 * criado uma categoria com esse nome.
 */

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const MERCHANT_RULES: { pattern: RegExp; targets: string[] }[] = [
  // "uber" como prefixo pega "Uberrides"/"Uber *Trip"; lookahead exclui Uberaba/Uberlândia
  { pattern: /\buber(?!aba|l[aâ]nd)|\b99 ?(app|pop|taxi)?\b|cabify|taxi|metro\b|onibus|estacionamento|pedagio|posto |shell|ipiranga|combustivel/, targets: ['transporte'] },
  // Pet shops ANTES de alimentação — "cobasi/petz" vendem ração, que o modelo
  // às vezes confunde com comida ("Cobasi" → Alimentação, incorreto).
  { pattern: /cobasi|\bpetz\b|petlove|\bpet ?(shop|love|z)\b|veterinari|\bracao\b/, targets: ['pets', 'pet'] },
  // "mercado" isolado (mercadinho, mercado municipal) é alimentação, mas
  // "mercado livre" é o marketplace — excluído aqui via lookahead negativo.
  { pattern: /ifood|rappi|restaurante|padaria|lanchonete|pizzari|hamburg|burger|\bmercado\b(?! ?livre)|supermercado|hortifruti|acougue|emporio|cafeteria|\bcafe\b/, targets: ['alimentacao'] },
  { pattern: /farmacia|drogaria|drogasil|droga raia|pague menos|panvel|laboratorio|clinica|odonto/, targets: ['saude'] },
  { pattern: /salao|barbearia|cabeleireiro|manicure|estetica|sobrancelha|\bspa\b|sephora|boticario|natura|\bavon\b|perfumaria/, targets: ['beleza', 'estetica'] },
  { pattern: /leroy|telhanorte|\bhavan\b|\bikea\b|tok ?stok|camicado|\bmadeira ?madeira\b|ferragens|utilidades|casa ?(&|e) ?video|casas ?bahia/, targets: ['casa', 'moradia', 'lar'] },
  { pattern: /netflix|spotify|disney|hbo|\bmax\b|prime video|youtube|cinema|ingresso|steam|playstation|xbox|nintendo/, targets: ['lazer', 'assinatura'] },
  { pattern: /renner|riachuelo|\bc ?& ?a\b|\bzara\b|hering|marisa|\bnike\b|adidas|\bvans\b|calcado|sapato|vestuario|roupa/, targets: ['vestuario', 'roupa'] },
  // Marketplaces genéricos (vendem de tudo) — checados ANTES de vestuário
  // pois "shein"/"shopee" também vendem roupa, mas o padrão de compra é
  // melhor descrito como "compras online" que como uma categoria única.
  { pattern: /mercado ?livre|amazon|ali ?express|\btemu\b|shopee|shein|magazine luiza|magalu|americanas\.com/, targets: ['compras online', 'compras', 'marketplace'] },
  { pattern: /apple ?\.? ?com ?\/? ?bill|apple bill|icloud|google one|google storage|dropbox|onedrive/, targets: ['nuvem', 'servico digital', 'servicos digitais', 'assinatura'] },
  { pattern: /centauro|decathlon|smart ?fit|bluefit|academia|suplemento/, targets: ['esporte'] },
  { pattern: /\bvivo\b|claro\b|\btim\b|telefonica|operadora/, targets: ['telefonia'] },
];

/** Categoria por regra de estabelecimento, restrita às categorias do usuário. */
export function fallbackCategory(description: string, allowedCategories: string[]): string | null {
  const desc = normalize(description);
  for (const rule of MERCHANT_RULES) {
    if (!rule.pattern.test(desc)) continue;
    for (const target of rule.targets) {
      const match = allowedCategories.find(c => normalize(c).includes(target));
      if (match) return match;
    }
  }
  return null;
}

/** true quando a categoria dada pelo modelo não agrega nada (vazia ou "Outro"). */
export function isUselessCategory(category: string | null): boolean {
  return category === null || normalize(category) === 'outro';
}

// ── Aprendizado: estabelecimento → categoria pelo histórico do usuário ──
// Reduz a cauda longa que nenhuma regra genérica cobre (comércios locais):
// se o usuário já categorizou "Padaria do Zé" antes, a próxima importação
// aproveita essa decisão. Tudo roda no client — o histórico não vai ao server.

export interface CategoryHint {
  category: string;
  count: number; // quantas vezes o usuário usou essa categoria para o estabelecimento
}

/**
 * Chave do estabelecimento: primeira palavra significativa da descrição
 * normalizada. "Cobasi Brasilia Asa" e "COBASI ASA SUL" caem na mesma chave
 * "cobasi". Palavras muito curtas (ex.: "dm") juntam a seguinte para dar sinal.
 */
export function merchantKey(description: string): string {
  const words = normalize(description).split(/\s+/).filter(w => /[a-z0-9]/.test(w));
  if (words.length === 0) return '';
  if (words[0].length >= 3) return words[0];
  return words.slice(0, 2).join(' ');
}

/** Constrói o mapa estabelecimento → categoria mais frequente do histórico. */
export function buildCategoryHints(
  txs: { description: string; category?: string | null }[]
): Map<string, CategoryHint> {
  const counts = new Map<string, Map<string, number>>();
  for (const t of txs) {
    const cat = (t.category ?? '').trim();
    if (!cat || normalize(cat) === 'outro') continue;
    const key = merchantKey(t.description);
    if (!key) continue;
    if (!counts.has(key)) counts.set(key, new Map());
    const m = counts.get(key)!;
    m.set(cat, (m.get(cat) ?? 0) + 1);
  }
  const hints = new Map<string, CategoryHint>();
  for (const [key, m] of Array.from(counts.entries())) {
    let best = '', bestN = 0;
    for (const [cat, n] of Array.from(m.entries())) if (n > bestN) { best = cat; bestN = n; }
    if (best) hints.set(key, { category: best, count: bestN });
  }
  return hints;
}

/**
 * Decide a categoria final de um item importado, combinando o que veio do
 * servidor (IA + regras genéricas) com o histórico pessoal do usuário:
 *  - se o servidor deixou sem categoria útil → usa o histórico (preenche "Outro");
 *  - se o servidor deu categoria útil → só o histórico BEM apoiado (usado ≥2×
 *    para aquele estabelecimento) sobrepõe, pois é decisão repetida do usuário.
 * Sempre restrito às categorias que o usuário ainda tem.
 */
export function resolveCategory(
  serverCategory: string | null,
  description: string,
  hints: Map<string, CategoryHint>,
  allowedCategories: string[]
): string | null {
  const key = merchantKey(description);
  const hint = key ? hints.get(key) : undefined;
  const hintCat = hint
    ? allowedCategories.find(c => normalize(c) === normalize(hint.category)) ?? null
    : null;

  if (isUselessCategory(serverCategory)) return hintCat ?? serverCategory;
  if (hintCat && hint!.count >= 2 && normalize(hintCat) !== normalize(serverCategory!)) {
    return hintCat;
  }
  return serverCategory;
}
