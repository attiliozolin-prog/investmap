import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { X } from 'lucide-react';
import styles from './AssetModal.module.css';

interface TransactionModalProps {
  assetId: string;
  onClose: () => void;
}

export default function TransactionModal({ assetId, onClose }: TransactionModalProps) {
  const { assets, addTransaction, updateAsset } = useApp();
  const asset = assets.find(a => a.id === assetId);

  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [value, setValue] = useState('');
  const [date, setDate] = useState<string>(() => {
    // Default: hoje no formato YYYY-MM-DD (timezone local)
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Fechar no Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!asset) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) {
      setError('Insira o valor da transação');
      return;
    }

    const numValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    if (isNaN(numValue) || numValue <= 0) {
      setError('Valor inválido');
      return;
    }

    // Validação de venda
    if (type === 'sell' && numValue > asset.currentValue) {
      setError('O valor de venda não pode ser maior que o valor atual do ativo');
      return;
    }

    // 1. Registra a transação com a data informada pelo usuário
    const dateIso = date ? new Date(date + 'T12:00:00').toISOString() : new Date().toISOString();
    addTransaction({
      assetId: asset.id,
      type,
      value: numValue,
      date: dateIso,
      notes: notes.trim() || undefined,
    });

    // 2. Atualiza os valores do ativo consolidados
    let newInvested = asset.investedValue;
    let newCurrent = asset.currentValue;

    if (type === 'buy') {
      newInvested += numValue;
      newCurrent += numValue;
    } else {
      // Venda parcial: reduz o valor atual diretamente
      newCurrent -= numValue;

      // Proporcionaliza o valor investido que foi retirado
      const proportionSold = numValue / asset.currentValue;
      const investedToRemove = asset.investedValue * proportionSold;

      newInvested -= investedToRemove;

      // Garante que não fique negativo por erro de arredondamento
      if (newInvested < 0 || newCurrent <= 0.01) {
        newInvested = 0;
        newCurrent = 0;
      }
    }

    updateAsset(asset.id, {
      investedValue: newInvested,
      currentValue: newCurrent,
    });

    onClose();
  };

  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setValue('');
      return;
    }
    const num = parseInt(raw, 10) / 100;
    setValue(
      num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
    setError('');
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Header */}
        <div className={styles.header}>
          <h2>Nova Transação em {asset.ticker}</h2>
          <button type="button" className={`btn btn-ghost btn-sm`} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <p style={{ color: 'var(--color-text-2)', fontSize: '0.85rem', marginBottom: 'var(--space-4)', marginTop: '-8px' }}>
          Saldo atual: R$ {asset.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Tipo de Movimentação</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className={`btn ${type === 'buy' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1 }}
                onClick={() => setType('buy')}
              >
                Aporte (+)
              </button>
              <button
                type="button"
                className={`btn ${type === 'sell' ? 'btn-danger' : 'btn-ghost'}`}
                style={{ flex: 1, backgroundColor: type === 'sell' ? 'var(--color-danger)' : undefined, color: type === 'sell' ? 'white' : undefined }}
                onClick={() => setType('sell')}
              >
                Venda Parcial (-)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="label" htmlFor="transactionValue">Valor Financeiro (R$) *</label>
            <input
              type="text"
              id="transactionValue"
              className="input"
              value={value}
              onChange={handleNumberInput}
              required
              placeholder="0,00"
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="transactionDate">Data da transação</label>
            <input
              type="date"
              id="transactionDate"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`}
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="transactionNotes">
              Observações <span style={{ color: 'var(--color-text-3)', fontWeight: 400 }}>(opcional)</span>
            </label>
            <input
              type="text"
              id="transactionNotes"
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              placeholder="Ex: Rebalanceamento trimestral"
              maxLength={200}
              autoComplete="off"
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.footer}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
