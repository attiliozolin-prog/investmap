import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { X, Info } from 'lucide-react';
import styles from './AssetModal.module.css';
import TaxModal from './TaxModal';
import { calculateTax, detectAssetType } from '@/lib/taxCalculator';
import { TaxCalculation, AssetType } from '@/types';

interface TransactionModalProps {
  assetId: string;
  onClose: () => void;
  initialType?: 'buy' | 'sell';
}

export default function TransactionModal({ assetId, onClose, initialType = 'buy' }: TransactionModalProps) {
  const { assets, transactions, sellTaxRecords, strategies, addTransaction, updateAsset, addSellTaxRecord } = useApp();
  const asset = assets.find(a => a.id === assetId);

  const [type, setType] = useState<'buy' | 'sell'>(initialType);
  const [value, setValue] = useState('');
  const [date, setDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Para ativos sem quantity/avgPrice (crypto manual, renda fixa), o usuário
  // pode informar o custo de aquisição manualmente ao registrar uma venda.
  const [manualCost, setManualCost] = useState('');

  // Preço unitário pago no aporte — só para ativos com quantidade.
  // Sem atualizar a quantidade junto com o aporte, o sync automático de
  // cotações (quantidade × preço) reverte o valor atual minutos depois.
  // Pré-preenchido com a cotação de mercado atual.
  const [unitPrice, setUnitPrice] = useState(() =>
    asset?.customPrice
      ? asset.customPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ''
  );

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

  // Detecta tipo tributário do ativo (null-safe: os hooks abaixo precisam
  // rodar em toda renderização — o early return de !asset vem depois deles)
  const assetType: AssetType = (() => {
    if (!asset) return 'acao';
    for (const s of strategies) {
      const cat = s.categories.find(c => c.id === asset.categoryId);
      if (cat) return detectAssetType(cat.className, cat.subclassName, asset.ticker);
    }
    return detectAssetType('', '', asset.ticker);
  })();

  // Ativos sem quantidade definida usam custo manual na venda
  const hasQuantity = !!asset?.quantity && asset.quantity > 0;

  // Para crypto e renda fixa sem qty, mostramos o campo de custo manual
  const needsManualCost = type === 'sell' && !hasQuantity;

  // Total de vendas do mesmo tipo no mesmo mês
  // (para isenção de R$ 20k em ações e R$ 35k em crypto)
  const monthlySalesOfSameType = useMemo(() => {
    const typesToCheck: AssetType[] = assetType === 'crypto'
      ? ['crypto']
      : assetType === 'acao'
      ? ['acao']
      : [];

    if (typesToCheck.length === 0) return 0;

    const [year, month] = date.split('-').map(Number);
    return sellTaxRecords
      .filter(r => {
        const [ry, rm] = r.sellDate.split('-').map(Number);
        return typesToCheck.includes(r.assetType) && ry === year && rm === month;
      })
      .reduce((sum, r) => sum + r.sellValue, 0);
  }, [assetType, date, sellTaxRecords]);

  if (!asset) return null;

  const handleNumberInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw) { setter(''); return; }
    const num = parseInt(raw, 10) / 100;
    setter(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setError('');
  };

  const parseValue = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) { setError('Insira o valor da transação'); return; }

    const numValue = parseValue(value);
    if (isNaN(numValue) || numValue <= 0) { setError('Valor inválido'); return; }

    if (type === 'sell') {
      if (numValue > asset.currentValue + 0.01) {
        setError('O valor de venda não pode ser maior que o valor atual do ativo');
        return;
      }

      // Custo proporcional: usa PME se tiver qty, senão usa custo manual informado
      let costBasis: number;

      if (hasQuantity && asset.investedValue > 0) {
        // PME automático: proporção da venda × custo total
        const proportion = asset.currentValue > 0 ? numValue / asset.currentValue : 1;
        costBasis = asset.investedValue * proportion;
      } else {
        // Custo manual (obrigatório para crypto/RF sem qty)
        const manualNum = manualCost ? parseValue(manualCost) : 0;
        if (!manualCost || isNaN(manualNum) || manualNum < 0) {
          setError('Informe o custo de aquisição (valor pago originalmente)');
          return;
        }
        costBasis = manualNum;
      }

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
      return;
    }

    // Aporte em ativo com quantidade: precisa do preço unitário para
    // calcular quantas unidades foram compradas
    if (hasQuantity) {
      const unitNum = unitPrice ? parseValue(unitPrice) : NaN;
      if (isNaN(unitNum) || unitNum <= 0) {
        setError('Informe o preço unitário pago na compra');
        return;
      }
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
    let newQuantity = asset.quantity;
    let newAvgPrice = asset.avgPrice;

    if (type === 'buy') {
      newInvested += numValue;

      if (hasQuantity) {
        // Ativos com quantidade (ações, cripto em modo auto): o aporte
        // precisa aumentar a quantidade e recalcular o PME, senão o sync
        // automático de cotações (quantidade × preço) desfaz o aporte no
        // valor atual na próxima sincronização.
        const unitNum = parseValue(unitPrice);
        const qtyBought = numValue / unitNum;
        newQuantity = (asset.quantity ?? 0) + qtyBought;
        newAvgPrice = newQuantity > 0 ? newInvested / newQuantity : undefined;
        // Valor atual alinhado ao que o sync calcula: quantidade × cotação
        const marketPrice = asset.customPrice ?? unitNum;
        newCurrent = newQuantity * marketPrice;
      } else {
        newCurrent += numValue;
      }
    } else {
      newCurrent -= numValue;
      if (hasQuantity && asset.currentValue > 0) {
        const proportionSold = Math.min(numValue / asset.currentValue, 1);
        newInvested -= asset.investedValue * proportionSold;
        // Reduz a quantidade na mesma proporção da venda, para o sync
        // de cotações não "ressuscitar" o valor vendido
        newQuantity = (asset.quantity ?? 0) * (1 - proportionSold);
      } else {
        // Para ativos sem qty, zera o custo proporcionalmente ao que foi vendido
        if (newCurrent <= 0.01) {
          newInvested = 0;
        } else {
          const proportionRemaining = newCurrent / asset.currentValue;
          newInvested = asset.investedValue * proportionRemaining;
        }
      }
      if (newInvested < 0 || newCurrent <= 0.01) {
        newInvested = 0;
        newCurrent = 0;
        if (hasQuantity) newQuantity = 0;
      }
    }

    updateAsset(asset.id, {
      investedValue: newInvested,
      currentValue: newCurrent,
      ...(hasQuantity ? { quantity: newQuantity, avgPrice: newAvgPrice } : {}),
    });
    onClose();
  };

  const handleTaxConfirm = () => {
    if (!pendingTaxCalc) return;
    const calc = pendingTaxCalc;

    // Para Renda Fixa (CDB, Tesouro Direto etc.) e LCI/LCA, o IR é sempre
    // retido na fonte pelo banco — o investidor NÃO precisa emitir DARF.
    // Marcamos taxPaid=true automaticamente para não gerar pendência falsa.
    const isWithheldAtSource = calc.assetType === 'renda_fixa' || calc.assetType === 'lci_lca';
    const sellDateIso = new Date(date + 'T12:00:00').toISOString();

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
      taxPaid: isWithheldAtSource,
      taxPaidAt: isWithheldAtSource ? sellDateIso : undefined,
      darfPeriod: calc.darfPeriod,
      notes: notes.trim() || undefined,
      sellDate: date,
    });

    setPendingTaxCalc(null);
    executeSave(pendingNumValue);
  };

  // Label do tipo de ativo para contexto
  const assetTypeHints: Partial<Record<AssetType, string>> = {
    crypto:     '🪙 Criptoativo — isenção de IR se vendas totais no mês ≤ R$ 35.000',
    renda_fixa: '🏦 Renda Fixa — IR retido na fonte pelo banco/corretora',
    lci_lca:    '✅ LCI/LCA — Isento de IR para Pessoa Física',
  };
  const assetHint = assetTypeHints[assetType];

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
      <div className="modal" role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h2>Nova Transação — {asset.ticker}</h2>
          <button type="button" className={`btn btn-ghost btn-sm`} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <p style={{ color: 'var(--color-text-2)', fontSize: '0.85rem', marginBottom: 'var(--space-4)', marginTop: '-8px' }}>
          Saldo atual: R$ {asset.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>

        {/* Hint do tipo tributário */}
        {assetHint && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', color: '#60A5FA', marginBottom: '16px' }}>
            <Info size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
            <span>{assetHint}</span>
          </div>
        )}

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
                Venda (−)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="label" htmlFor="transactionValue">Valor da {type === 'buy' ? 'Compra' : 'Venda'} (R$) *</label>
            <input type="text" id="transactionValue" className="input" value={value} onChange={handleNumberInput(setValue)} required placeholder="0,00" autoComplete="off" />
          </div>

          {/* Preço unitário — apenas para aporte em ativos com quantidade */}
          {type === 'buy' && hasQuantity && (
            <div className="form-group">
              <label className="label" htmlFor="unitPrice">
                Preço unitário pago (R$) *
                <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--color-text-3)', marginLeft: '6px' }}>
                  pré-preenchido com a cotação atual
                </span>
              </label>
              <input
                type="text"
                id="unitPrice"
                className="input"
                value={unitPrice}
                onChange={handleNumberInput(setUnitPrice)}
                placeholder="0,00"
                autoComplete="off"
              />
              {(() => {
                const v = value ? parseValue(value) : NaN;
                const u = unitPrice ? parseValue(unitPrice) : NaN;
                if (isNaN(v) || isNaN(u) || v <= 0 || u <= 0) return null;
                const qty = v / u;
                return (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', margin: '6px 2px 0' }}>
                    ≈ {qty.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} {asset.ticker} nesta compra
                  </p>
                );
              })()}
            </div>
          )}

          {/* Campo de custo de aquisição — apenas para ativos sem qty na venda */}
          {needsManualCost && (
            <div className="form-group">
              <label className="label" htmlFor="manualCost">
                Custo de Aquisição (R$) *
                <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--color-text-3)', marginLeft: '6px' }}>
                  quanto você pagou originalmente
                </span>
              </label>
              <input
                type="text"
                id="manualCost"
                className="input"
                value={manualCost}
                onChange={handleNumberInput(setManualCost)}
                placeholder="0,00"
                autoComplete="off"
              />
            </div>
          )}

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
              {type === 'sell' ? 'Ver cálculo de IR →' : 'Confirmar aporte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
