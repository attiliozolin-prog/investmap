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
  // "mercado" isolado (mercadinho, mercado municipal) é alimentação, mas
  // "mercado livre" é o marketplace — excluído aqui via lookahead negativo.
  { pattern: /ifood|rappi|restaurante|padaria|lanchonete|pizzari|hamburg|burger|\bmercado\b(?! ?livre)|supermercado|hortifruti|acougue|emporio|cafeteria|\bcafe\b/, targets: ['alimentacao'] },
  { pattern: /farmacia|drogaria|drogasil|droga raia|pague menos|panvel|laboratorio|clinica|odonto/, targets: ['saude'] },
  { pattern: /netflix|spotify|disney|hbo|\bmax\b|prime video|youtube|cinema|ingresso|steam|playstation|xbox|nintendo/, targets: ['lazer', 'assinatura'] },
  { pattern: /renner|riachuelo|\bc ?& ?a\b|\bzara\b|hering|marisa|\bnike\b|adidas|\bvans\b|calcado|sapato|vestuario|roupa/, targets: ['vestuario', 'roupa'] },
  // Marketplaces genéricos (vendem de tudo) — checados ANTES de vestuário
  // pois "shein"/"shopee" também vendem roupa, mas o padrão de compra é
  // melhor descrito como "compras online" que como uma categoria única.
  { pattern: /mercado ?livre|amazon|ali ?express|\btemu\b|shopee|shein|magazine luiza|magalu|americanas\.com|casas bahia/, targets: ['compras online', 'compras', 'marketplace'] },
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
