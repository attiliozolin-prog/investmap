/**
 * Registro central de falhas de sincronização com o Supabase.
 *
 * As escritas do app são otimistas (o estado local muda na hora e o banco
 * é atualizado em background). Antes, uma falha virava só um console.error
 * e o usuário nunca sabia que a nuvem tinha divergido. Este módulo permite
 * que qualquer camada reporte a falha e que a UI mostre um aviso.
 */

type Listener = (failCount: number) => void;

let failCount = 0;
const listeners = new Set<Listener>();

export function reportSyncError(label: string, error: unknown): void {
  console.error(`[sync] ${label}:`, error);
  failCount++;
  listeners.forEach(l => l(failCount));
}

export function resetSyncErrors(): void {
  failCount = 0;
  listeners.forEach(l => l(failCount));
}

export function getSyncErrorCount(): number {
  return failCount;
}

export function subscribeSyncErrors(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
