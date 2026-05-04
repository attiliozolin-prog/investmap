import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { X } from 'lucide-react';
import styles from './AssetModal.module.css';
import TaxModal from './TaxModal';
import { calculateTax, detectAssetType } from '@/lib/taxCalculator';
import { TaxCalculation, AssetType } from '@/types';

interface TransactionModalProps {
  assetId: string;
  onClose: () => void;
}

export default function TransactionModal({ assetId, onClose }: TransactionModalProps) {
  const { assets, transactions, sellTaxRecords, strategies, addTransaction, updateAsset, addSellTaxRecord } = useApp();
  const asset = assets.find(a => a.id === assetId);

  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [value, setValue] = useState('');
  const [date, setDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Estado do TaxModal
  const [pendingTaxCalc, setPendingTaxCalc] = useState<TaxCalculation | null>(null);
  const [pendingNumValue, setPendingNumValue] = useState(0);

  // Fechar no Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingTaxCalc) setPendingTaxCalc(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, pendingTaxCalc]);

  if (!asset) return null;

  // Detecta tipo tributário do ativo
  const assetType: AssetType = (() => {
    for (const s of strategies) {
      const cat = s.categories.find(c => c.id === asset.categoryId);
      if (cat) return detectAssetType(cat.className, cat.subclassName, asset.ticker);
    }
    return detectAssetType('', '', asset.ticker);
  })();

  // Total de vendas do mesmo tipo no mesmo mês (para limite de isenção de ações)
  const monthlySalesOfSameType = useMemo(() => {
    if (assetType !== 'acao') return 0;
    const [year, month] = date.split('-').map(Number);
    return sellTaxRecords
      .filter(r => {
        const [ry, rm] = r.sellDate.split('-').map(Number);
        return r.assetType === 'acao' && ry === year && rm === month;
      })
      .reduce((sum, r) => sum + r.sellValue, 0);
  }, [assetType, date, sellTaxRecords]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) { setError('Insira o valor da transação'); return; }

    const numValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    if (isNaN(numValue) || numValue <= 0) { setError('Valor inválido'); return; }

    if (type === 'sell' && numValue > asset.currentValue) {
      setError('O valor de venda não pode ser maior que o valor atual do ativo');
      return;
    }

    if (type === 'sell') {
      // Custo proporcional = proporção da venda × valor investido
      const proportion = asset.currentValue > 0 ? numValue / asset.currentValue : 1;
      const costBasis = asset.investedValue * proportion;

      const calc = calculateTax(
        assetType,
        numValue,
        costBasis,
        date,
        asset.createdAt,
        monthlySalesOfSameType,
      );

      setPendingNumValue(numValue);
      setPendingTaxCalc(calc);
      return; // aguarda confirmação no TaxModal
    }

    executeSave(numValue);
  };

  const executeSave = (numValue: number) => {
    const dateIso = date ? new Date(date + 'T12:00:00').toISOString() : new Date().toISOString();
    addTransaction({
      assetId: asset.id,
      type,
      value: numValue,
      date: dateIso,
      notes: notes.trim() || undefined,
    });

    let newInvested = asset.investedValue;
    let newCurrent = asset.currentValue;

    if (type === 'buy') {
      newInvested += numValue;
      newCurrent += numValue;
    } else {
      newCurrent -= numValue;
      const proportionSold = numValue / asset.currentValue;
      newInvested -= asset.investedValue * proportionSold;
      if (newInvested < 0 || newCurrent <= 0.01) { newInvested = 0; newCurrent = 0; }
    }

    updateAsset(asset.id, { investedValue: newInvested, currentValue: newCurrent });
    onClose();
  };

  const handleTaxConfirm = () => {
    if (!pendingTaxCalc) return;
    const calc = pendingTaxCalc;

    // Salva o registro de IR
    addSellTaxRecord({
      assetId: asset.id,
      assetTicker: asset.ticker,
      sellValue: calc.sellValue,
      costBasis: calc.costBasis,
      profitLoss: calc.profitLoss,
      assetType: calc.assetType,
      taxRate: calc.taxRate,
      taxDue: calc.taxDue,
      isExempt: calc.isExempt,
      exemptReason: calc.exemptReason,
      isLoss: calc.isLoss,
      lossUsedForCompensation: 0,
      taxPaid: false,
      darfPeriod: calc.darfPeriod,
      notes: notes.trim() || undefined,
      sellDate: date,
    });

    setPendingTaxCalc(null);
    executeSave(pendingNumValue);
  };

  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw) { setValue(''); return; }
    const num = parseInt(raw, 10) / 100;
    setValue(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setError('');
  };

  if (pendingTaxCalc) {
    return (
      <TaxModal
        calc={pendingTaxCalc}
        ticker={asset.ticker}
        onConfirm={handleTaxConfirm}
        onCancel={() => setPendingTaxCalc(null)}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
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
              <button type="button" className={`btn ${type === 'buy' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setType('buy')}>
                Aporte (+)
              </button>
              <button
                type="button"
                className={`btn ${type === 'sell' ? 'btn-danger' : 'btn-ghost'}`}
                style={{ flex: 1, backgroundColor: type === 'sell' ? 'var(--color-danger)' : undefined, color: type === 'sell' ? 'white' : undefined }}
                onClick={() => setType('sell')}
              >
                Venda (-)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="label" htmlFor="transactionValue">Valor Financeiro (R$) *</label>
            <input type="text" id="transactionValue" className="input" value={value} onChange={handleNumberInput} required placeholder="0,00" autoComplete="off" />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="transactionDate">Data da transação</label>
            <input type="date" id="transactionDate" className="input" value={date} onChange={(e) => setDate(e.target.value)}
              max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`} />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="transactionNotes">
              Observações <span style={{ color: 'var(--color-text-3)', fontWeight: 400 }}>(opcional)</span>
            </label>
            <input type="text" id="transactionNotes" className="input" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              placeholder="Ex: Rebalanceamento trimestral" maxLength={200} autoComplete="off" />
          </div>

          {type === 'sell' && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.5rem', padding: '0.65rem 0.85rem', fontSize: '0.82rem', color: '#FBBF24', marginBottom: '0.75rem' }}>
              ⚠️ Ao confirmar uma venda, você verá um resumo do Imposto de Renda aplicável antes de finalizar.
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.footer}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">
              {type === 'sell' ? 'Ver cálculo de IR →' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
