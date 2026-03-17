import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
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

    // 1. Registra a transação
    addTransaction({
      assetId: asset.id,
      type,
      value: numValue
    });

    // 2. Atualiza os valores do ativo consolidados
    let newInvested = asset.investedValue;
    let newCurrent = asset.currentValue;

    if (type === 'buy') {
      newInvested += numValue;
      newCurrent += numValue; // Suposição base: aporte aumenta saldo atual em 1:1 na largada
    } else {
      // Venda parcial:
      // Reduz o valor atual diretamente
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
      currentValue: newCurrent
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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>

        <h2 className={styles.title}>Nova Transação em {asset.ticker}</h2>
        <p style={{ color: 'var(--color-text-2)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
          Atual atual: R$ {asset.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Tipo de Movimentação</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className={`btn ${type === 'buy' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1 }}
                onClick={() => setType('buy')}
              >
                Novo Aporte (+)
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

          <div className={styles.formGroup}>
            <label htmlFor="transactionValue">Valor Financeiro (R$) *</label>
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
