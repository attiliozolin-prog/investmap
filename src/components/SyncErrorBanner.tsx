'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  subscribeSyncState,
  dismissSyncWarnings,
  getSyncState,
  type SyncState,
} from '@/lib/syncStatus';

const EMPTY: SyncState = { writeFailures: 0, staleTickers: [] };

// Lista longa vira ruído no banner — 17 tickers não cabem em uma frase.
function listTickers(tickers: string[]): string {
  if (tickers.length <= 3) return tickers.join(', ');
  return `${tickers.slice(0, 3).join(', ')} e mais ${tickers.length - 3}`;
}

/**
 * Banner fixo exibido quando a sincronização com a nuvem tem algum problema.
 *
 * Dois casos, com gravidades diferentes:
 * - escrita perdida (vermelho): o dado só existe neste aparelho.
 * - cotação defasada (âmbar): o dado está salvo, mas o preço na tela é velho.
 */
export default function SyncErrorBanner() {
  const [state, setState] = useState<SyncState>(EMPTY);

  useEffect(() => {
    setState(getSyncState());
    return subscribeSyncState(setState);
  }, []);

  const { writeFailures, staleTickers } = state;
  if (writeFailures === 0 && staleTickers.length === 0) return null;

  // Escrita perdida é mais grave que cotação velha: quando as duas
  // acontecem juntas, é essa que o usuário precisa ver.
  const isWriteFailure = writeFailures > 0;

  const message = isWriteFailure
    ? `${writeFailures === 1
        ? 'Uma alteração não foi salva'
        : `${writeFailures} alterações não foram salvas`} na nuvem. Seus dados estão seguros neste dispositivo — verifique sua conexão e recarregue a página.`
    : `Sem cotação para ${staleTickers.length === 1
        ? staleTickers[0]
        : `${staleTickers.length} ativos (${listTickers(staleTickers)})`}. Os valores exibidos podem estar defasados.`;

  const palette = isWriteFailure
    ? { bg: '#3B1D1D', border: '#EF4444', text: '#FECACA', icon: '#EF4444' }
    : { bg: '#3B2F1D', border: '#F59E0B', text: '#FDE68A', icon: '#F59E0B' };

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        maxWidth: 'min(92vw, 480px)',
        padding: '10px 14px',
        borderRadius: 10,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.text,
        fontSize: '0.82rem',
        lineHeight: 1.4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      }}
    >
      <AlertTriangle size={18} style={{ flexShrink: 0, color: palette.icon }} />
      <span>{message}</span>
      <button
        onClick={dismissSyncWarnings}
        aria-label="Dispensar aviso"
        style={{ background: 'none', border: 'none', color: palette.text, cursor: 'pointer', padding: 2, flexShrink: 0 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
