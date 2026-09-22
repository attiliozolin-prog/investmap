/**
 * Há quanto tempo cada ticker teve uma cotação boa.
 *
 * Existe para separar duas coisas que antes eram tratadas como uma só:
 *
 *   "faltou cotação nesta sincronização"  ≠  "o preço na tela está velho"
 *
 * A primeira acontece o tempo todo por motivo banal — a Brapi engasgou,
 * o papel não teve negócio no minuto, a rede oscilou — e não muda nada
 * para quem usa o app: o valor exibido é de minutos atrás. Alarmar nesse
 * caso treina o usuário a ignorar o aviso, que é o pior resultado
 * possível, porque aí ele também ignora quando o aviso importa.
 *
 * Este módulo guarda o instante da ÚLTIMA cotação bem-sucedida de cada
 * ticker e deixa a UI perguntar o que de fato interessa: "esse preço já
 * está velho a ponto de valer um aviso?".
 *
 * Fica em localStorage (não no banco) de propósito: é informação de
 * diagnóstico, por dispositivo, que não vale uma migração de schema nem
 * uma escrita no Supabase a cada sincronização.
 */

const STORAGE_KEY = 'investmap_price_last_ok';

/**
 * Só avisa quando o preço passa de 5 dias.
 *
 * O número precisa cobrir a maior parada normal do mercado sem disparar:
 * um feriado emendado numa sexta deixa a B3 fechada de quinta a terça
 * (~4 dias), e nesse período o preço de fechamento é o valor CORRETO, não
 * um valor defasado. Cinco dias passa folgado disso e ainda pega qualquer
 * coisa de fato quebrada — um ticker digitado errado, um papel deslistado,
 * uma fonte que parou de responder.
 *
 * Este é um app de monitoramento de carteira, não uma mesa de operações:
 * ver o patrimônio com alguns dias de atraso não causa dano, e um banner
 * de erro a cada oscilação da API causa.
 */
export const STALE_WARNING_MS = 5 * 24 * 60 * 60 * 1000;

type Record_ = Record<string, number>;

function read(): Record_ {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object') return {};
    return parsed as Record_;
  } catch {
    return {};
  }
}

function write(data: Record_): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* cota cheia ou storage bloqueado — não é motivo para quebrar o sync */ }
}

/** Registra que o ticker voltou com preço agora. */
export function markPriceFresh(tickers: string[], now: number = Date.now()): void {
  if (tickers.length === 0) return;
  const data = read();
  for (const t of tickers) data[t.toUpperCase()] = now;
  write(data);
}

/**
 * Filtra, entre os tickers que falharam, apenas aqueles velhos o bastante
 * para merecer um aviso na tela.
 *
 * Um ticker nunca visto antes ganha o benefício da dúvida: registramos o
 * instante atual como marco inicial e ficamos quietos. Se ele continuar
 * falhando, o prazo corre a partir daí e o aviso aparece — um papel
 * digitado errado não fica invisível para sempre, só deixa de gritar no
 * primeiro segundo.
 */
export function selectStaleEnoughToWarn(
  failedTickers: string[],
  now: number = Date.now(),
): string[] {
  if (failedTickers.length === 0) return [];

  const data = read();
  const warn: string[] = [];
  let touched = false;

  for (const raw of failedTickers) {
    const ticker = raw.toUpperCase();
    const lastOk = data[ticker];

    if (typeof lastOk !== 'number' || !Number.isFinite(lastOk)) {
      // Primeira vez que vemos este ticker falhar: começa a contar agora.
      data[ticker] = now;
      touched = true;
      continue;
    }

    if (now - lastOk > STALE_WARNING_MS) warn.push(raw);
  }

  if (touched) write(data);
  return warn;
}

/** Usado pelos testes e por uma eventual limpeza de dados locais. */
export function resetPriceFreshness(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
