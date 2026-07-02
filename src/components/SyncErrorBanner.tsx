'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { subscribeSyncErrors, resetSyncErrors, getSyncErrorCount } from '@/lib/syncStatus';

/**
 * Banner fixo exibido quando alguma escrita no Supabase falhou.
 * Os dados continuam salvos localmente (localStorage); o aviso existe
 * para o usuário saber que a nuvem está divergente e recarregar/tentar de novo.
 */
export default function SyncErrorBanner() {
  const [failCount, setFailCount] = useState(0);

  useEffect(() => {
    setFailCount(getSyncErrorCount());
    return subscribeSyncErrors(setFailCount);
  }, []);

  if (failCount === 0) return null;

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
        background: '#3B1D1D',
        border: '1px solid #EF4444',
        color: '#FECACA',
        fontSize: '0.82rem',
        lineHeight: 1.4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      }}
    >
      <AlertTriangle size={18} style={{ flexShrink: 0, color: '#EF4444' }} />
      <span>
        {failCount === 1
          ? 'Uma alteração não foi salva na nuvem.'
          : `${failCount} alterações não foram salvas na nuvem.`}{' '}
        Seus dados estão seguros neste dispositivo — verifique sua conexão e recarregue a página.
      </span>
      <button
        onClick={resetSyncErrors}
        aria-label="Dispensar aviso"
        style={{ background: 'none', border: 'none', color: '#FECACA', cursor: 'pointer', padding: 2, flexShrink: 0 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
