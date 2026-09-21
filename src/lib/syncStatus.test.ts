import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  reportSyncError,
  reportStaleQuotes,
  dismissSyncWarnings,
  getSyncState,
  subscribeSyncState,
  mergeStaleTickers,
  type SyncState,
} from './syncStatus';

// O módulo guarda estado global; cada teste começa do zero.
beforeEach(() => {
  dismissSyncWarnings();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('escritas perdidas', () => {
  it('acumula, porque cada alteração que não subiu importa', () => {
    reportSyncError('escrita no banco', new Error('offline'));
    reportSyncError('escrita no banco', new Error('offline'));
    expect(getSyncState().writeFailures).toBe(2);
  });

  it('não mexe na lista de cotações defasadas', () => {
    reportStaleQuotes(['PETR4']);
    reportSyncError('escrita no banco', new Error('offline'));
    expect(getSyncState()).toEqual<SyncState>({ writeFailures: 1, staleTickers: ['PETR4'] });
  });
});

describe('cotações defasadas', () => {
  it('substitui em vez de acumular — vale a última sincronização', () => {
    reportStaleQuotes(['PETR4', 'ITUB4']);
    reportStaleQuotes(['WEGE3']);
    expect(getSyncState().staleTickers).toEqual(['WEGE3']);
  });

  it('lista vazia limpa o aviso quando a fonte de preços volta', () => {
    reportStaleQuotes(['PETR4', 'ITUB4']);
    reportStaleQuotes([]);
    expect(getSyncState().staleTickers).toEqual([]);
  });
});

describe('assinantes', () => {
  it('recebem o estado a cada mudança', () => {
    const seen: SyncState[] = [];
    const unsubscribe = subscribeSyncState(s => seen.push(s));

    reportStaleQuotes(['PETR4']);
    reportSyncError('escrita no banco', new Error('offline'));

    expect(seen).toEqual<SyncState[]>([
      { writeFailures: 0, staleTickers: ['PETR4'] },
      { writeFailures: 1, staleTickers: ['PETR4'] },
    ]);
    unsubscribe();
  });

  it('não são notificados quando uma sync completa sucede outra completa', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSyncState(listener);

    reportStaleQuotes([]);
    reportStaleQuotes([]);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('param de receber depois do unsubscribe', () => {
    const listener = vi.fn();
    subscribeSyncState(listener)();

    reportStaleQuotes(['PETR4']);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('dismissSyncWarnings', () => {
  it('limpa os dois canais de uma vez', () => {
    reportSyncError('escrita no banco', new Error('offline'));
    reportStaleQuotes(['PETR4']);

    dismissSyncWarnings();

    expect(getSyncState()).toEqual<SyncState>({ writeFailures: 0, staleTickers: [] });
  });
});

describe('mergeStaleTickers — syncs parciais', () => {
  it('preserva o aviso de quem não foi tentado nesta rodada', () => {
    // Pregão fechado: só a cripto é buscada, e ela volta OK. O aviso de
    // PETR4, que ninguém tentou, tem de continuar de pé.
    reportStaleQuotes(['PETR4', 'BBSE3']);
    expect(mergeStaleTickers([], ['BTC', 'ETH'])).toEqual(['PETR4', 'BBSE3']);
  });

  it('limpa o aviso de quem foi tentado e voltou com preço', () => {
    reportStaleQuotes(['PETR4', 'BBSE3']);
    expect(mergeStaleTickers([], ['PETR4', 'BBSE3'])).toEqual([]);
  });

  it('limpa só quem voltou, mantendo o que falhou de novo', () => {
    reportStaleQuotes(['PETR4', 'BBSE3']);
    expect(mergeStaleTickers(['BBSE3'], ['PETR4', 'BBSE3'])).toEqual(['BBSE3']);
  });

  it('não duplica um ticker que já estava na lista e falhou de novo', () => {
    reportStaleQuotes(['PETR4']);
    expect(mergeStaleTickers(['PETR4'], ['PETR4'])).toEqual(['PETR4']);
  });

  it('acrescenta falhas novas às antigas que seguem valendo', () => {
    reportStaleQuotes(['PETR4']);
    expect(mergeStaleTickers(['TAEE11'], ['TAEE11', 'BTC'])).toEqual(['PETR4', 'TAEE11']);
  });
});
