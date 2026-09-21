/**
 * Janela de negociação da B3, em horário de Brasília.
 *
 * Existe para não gastar cota da Brapi buscando preço que não muda: fora
 * do pregão a cotação é sempre a do fechamento. Cripto NÃO passa por aqui
 * — negocia 24/7 e vem do CoinGecko, que tem limite próprio.
 *
 * Tudo é calculado em `America/Sao_Paulo` via `Intl`, nunca no fuso do
 * aparelho: o usuário pode estar viajando ou com o relógio em UTC.
 *
 * Feriados da B3 não são modelados de propósito. Custam alguns syncs
 * desperdiçados por ano (~10 dias), o que é irrelevante perto do ganho,
 * e uma tabela de feriados exigiria manutenção anual.
 */

const TZ = 'America/Sao_Paulo';

// Pregão regular da B3: 10h às 18h. O fechamento real varia com o leilão
// (~17h55), e o after-market vai até 18h30 com liquidez mínima. 18h é uma
// borda generosa o suficiente para pegar o preço de fechamento.
export const B3_OPEN_HOUR = 10;
export const B3_CLOSE_HOUR = 18;

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

type SPParts = {
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
  /** 0 = domingo … 6 = sábado */
  dow: number;
};

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function partsInSaoPaulo(date: Date): SPParts {
  const map: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  // `hour12: false` pode devolver "24" à meia-noite em alguns runtimes.
  const hour = Number(map.hour) % 24;
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour,
    minute: Number(map.minute),
    dow: WEEKDAY_INDEX[map.weekday] ?? 0,
  };
}

function isWeekday(dow: number): boolean {
  return dow >= 1 && dow <= 5;
}

/** Pregão regular aberto neste instante (seg–sex, 10h–18h de Brasília). */
export function isB3Open(now: Date = new Date()): boolean {
  const p = partsInSaoPaulo(now);
  return isWeekday(p.dow) && p.hour >= B3_OPEN_HOUR && p.hour < B3_CLOSE_HOUR;
}

/**
 * Identificador (YYYY-MM-DD em Brasília) do último pregão JÁ FECHADO.
 *
 * Serve para o sync de recuperação: ao abrir o app com o mercado fechado,
 * queremos uma única busca para pegar o preço de fechamento — e não
 * repeti-la a cada 30 min durante todo o fim de semana. Guardando esta
 * chave, a busca acontece uma vez por sessão encerrada.
 *
 * Retorna null se não achar pregão fechado em 10 dias (não deve acontecer;
 * é só um limite defensivo para o laço).
 */
export function lastClosedSessionKey(now: Date = new Date()): string | null {
  let cursor = now;
  for (let daysBack = 0; daysBack < 10; daysBack++) {
    const p = partsInSaoPaulo(cursor);
    // Dias anteriores a hoje já fecharam por completo; hoje só conta
    // depois do horário de fechamento.
    const alreadyClosed = daysBack > 0 || p.hour >= B3_CLOSE_HOUR;
    if (isWeekday(p.dow) && alreadyClosed) {
      return `${p.year}-${p.month}-${p.day}`;
    }
    // Brasil não tem horário de verão desde 2019, então recuar 24h sempre
    // cai no dia anterior — não há dia de 23h ou 25h para tratar.
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return null;
}
