import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Strategy } from '@/types';

interface DeleteStrategyModalProps {
  strategy: Pick<Strategy, 'id' | 'name'>;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export default function DeleteStrategyModal({ strategy, onClose, onConfirm }: DeleteStrategyModalProps) {
  const [confirmationText, setConfirmationText] = useState('');

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationText === 'DELETAR') {
      onConfirm(strategy.id);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)' }}>
            <AlertTriangle size={20} /> Excluir Carteira
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ marginBottom: 'var(--space-6)', color: 'var(--color-text-2)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          <p>Você está prestes a excluir permanentemente a carteira <strong>{strategy.name}</strong>.</p>
          <p style={{ marginTop: '8px' }}>
            Essa ação removerá <strong>todos os ativos, aportes e histórico</strong> vinculados a ela.
            Esta ação <strong>não pode ser desfeita</strong>.
          </p>
        </div>

        <form onSubmit={handleDelete}>
          <div className="form-group">
            <label className="label" htmlFor="confirmDelete">
              Para confirmar, digite <strong>DELETAR</strong> no campo abaixo:
            </label>
            <input
              type="text"
              id="confirmDelete"
              className="input"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Digite DELETAR"
              autoComplete="off"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 'var(--space-6)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={confirmationText !== 'DELETAR'}
            >
              Excluir Definitivamente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
