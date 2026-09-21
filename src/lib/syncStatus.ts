/**
 * Registro central de problemas de sincronização.
 *
 * As escritas do app são otimistas (o estado local muda na hora e o banco
 * é atualizado em background). Antes, uma falha virava só um console.error
 * e o usuário nunca sabia que a nuvem tinha divergido. Este módulo permite
 * que qualquer camada reporte a falha e que a UI mostre um aviso.
 *
 * São dois canais separados porque a causa e a consequência são diferentes:
 *
 * - escritas perdidas: o dado mudou no aparelho mas não subiu para o
 *   Supabase. Acumula, porque cada alteração perdida importa.
 * - cotações defasadas: a busca de preços não trouxe valor para alguns
 *   ativos. Não acumula — vale sempre o resultado da última sincronização.
 */

export type SyncState = {
  /** Escritas no Supabase que falharam desde o carregamento da página. */
  writeFailures: number;
  /** Tickers elegíveis que ficaram sem cotação na última sincronização. */
  staleTickers: string[];
};

type Listener = (state: SyncState) => void;

let state: SyncState = { writeFailures: 0, staleTickers: [] };
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach(l => l(state));
}

export function reportSyncError(label: string, error: unknown): void {
  console.error(`[sync] ${label}:`, error);
  state = { ...state, writeFailures: state.writeFailures + 1 };
  emit();
}

/**
 * Substitui (não acumula) a lista de tickers sem cotação. Deve ser chamada
 * a cada sincronização, inclusive com lista vazia quando tudo deu certo —
 * é assim que o aviso some depois que a fonte de preços volta.
 */
export function reportStaleQuotes(tickers: string[]): void {
  if (tickers.length > 0) {
    console.warn(`[sync] sem cotação para: ${tickers.join(', ')}`);
  }
  // Sync completa depois de sync completa: nada mudou, não notifica.
  if (state.staleTickers.length === 0 && tickers.length === 0) return;
  state = { ...state, staleTickers: tickers };
  emit();
}

/**
 * Combina os tickers sem cotação de uma sincronização com os avisos que
 * ainda valem de rodadas anteriores.
 *
 * Existe porque nem toda sync tenta todos os ativos: fora do pregão só a
 * cripto é buscada. Sem isso, uma sync parcial bem-sucedida limparia o
 * aviso de um ativo da B3 que continua com preço velho — o silêncio que
 * este módulo existe para evitar.
 *
 * `attempted` são os tickers efetivamente buscados agora; só eles têm o
 * direito de sair da lista.
 */
export function mergeStaleTickers(stale: string[], attempted: string[]): string[] {
  const tried = new Set(attempted);
  const carriedOver = state.staleTickers.filter(t => !tried.has(t));
  return Array.from(new Set([...carriedOver, ...stale]));
}

export function dismissSyncWarnings(): void {
  state = { writeFailures: 0, staleTickers: [] };
  emit();
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSyncState(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
