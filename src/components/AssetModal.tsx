'use client';

import { useState, useEffect, useCallback } from 'react';
import { Asset, StrategyCategory } from '@/types';
import styles from './AssetModal.module.css';
import { X, RefreshCw, Calculator } from 'lucide-react';
import TickerSearch from './TickerSearch';
import { fetchAssetPrice, detectPriceMode } from '@/lib/brapi';

interface Props {
  categories: StrategyCategory[];
  strategyId: string;
  asset?: Asset | null;
  onSave: (data: Omit<Asset, 'id' | 'updatedAt'>) => void;
  onClose: () => void;
}

const parseNum = (v: string) => parseFloat(v.replace(',', '.'));
const fmtNum = (v: number) => v.toFixed(2).replace('.', ',');

export default function AssetModal({ categories, strategyId, asset, onSave, onClose }: Props) {
  const [ticker, setTicker] = useState('');
  const [info, setInfo] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [selectedClass, setSelectedClass] = useState('');

  // Campos de quantidade e preços
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');     // PME — custo histórico por ação
  const [currentPrice, setCurrentPrice] = useState(''); // preço de mercado atual
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto');

  // Totais: derivados automaticamente se qty+preço presentes, senão manuais
  const [manualInvested, setManualInvested] = useState('');
  const [manualCurrent, setManualCurrent] = useState('');

  const [error, setError] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  const uniqueClasses = Array.from(new Set(categories.map(c => c.className)));

  // ---------------------------------------------------------------
  // Valores derivados: qty × avgPrice = custo; qty × currentPrice = valor atual
  // ---------------------------------------------------------------
  const qtyNum = parseNum(quantity);
  const avgNum = parseNum(avgPrice);
  const mktNum = parseNum(currentPrice);

  const derivedInvested = !isNaN(qtyNum) && qtyNum > 0 && !isNaN(avgNum) && avgNum > 0
    ? qtyNum * avgNum : null;

  const derivedCurrent = !isNaN(qtyNum) && qtyNum > 0 && !isNaN(mktNum) && mktNum > 0
    ? qtyNum * mktNum : null;

  // Custo e valor final (derivado tem prioridade; manual como fallback)
  const effectiveInvested = derivedInvested ?? parseNum(manualInvested);
  const effectiveCurrent = derivedCurrent ?? parseNum(manualCurrent);

  // ---------------------------------------------------------------
  // Preenche campos ao editar ativo existente
  // ---------------------------------------------------------------
  useEffect(() => {
    if (asset) {
      setTicker(asset.ticker);
      setInfo(asset.info);
      setCategoryId(asset.categoryId);
      const matchedCat = categories.find(c => c.id === asset.categoryId);
      if (matchedCat) setSelectedClass(matchedCat.className);

      if (asset.quantity) setQuantity(asset.quantity.toString().replace('.', ','));
      if (asset.avgPrice) setAvgPrice(fmtNum(asset.avgPrice));
      if (asset.customPrice) setCurrentPrice(fmtNum(asset.customPrice));
      setPriceMode(asset.priceMode ?? detectPriceMode(asset.ticker));

      // Só preenche manuais se não tiver quantidade+PME definidos
      if (!asset.avgPrice || !asset.quantity) {
        setManualInvested(fmtNum(asset.investedValue));
      }
      if (!asset.customPrice || !asset.quantity) {
        setManualCurrent(fmtNum(asset.currentValue));
      }
    } else if (categories.length > 0) {
      const initialClass = uniqueClasses[0] ?? '';
      setSelectedClass(initialClass);
      const initialSubclasses = categories.filter(c => c.className === initialClass);
      if (initialSubclasses.length > 0) setCategoryId(initialSubclasses[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, categories]);

  // Quando o ticker muda em modo de criação, reavalia o priceMode
  useEffect(() => {
    if (!asset && ticker) {
      setPriceMode(detectPriceMode(ticker));
    }
  }, [ticker, asset]);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClass = e.target.value;
    setSelectedClass(newClass);
    const subs = categories.filter(c => c.className === newClass);
    setCategoryId(subs.length > 0 ? subs[0].id : '');
  };

  const filteredSubclasses = categories.filter(c => c.className === selectedClass);

  // ---------------------------------------------------------------
  // Busca cotação atual (preço de mercado)
  // ---------------------------------------------------------------
  const handleFetchPrice = useCallback(async () => {
    if (!ticker) return;
    setIsFetchingPrice(true);
    setError('');
    const fetched = await fetchAssetPrice(ticker);
    setIsFetchingPrice(false);
    if (fetched !== null) {
      setCurrentPrice(fmtNum(fetched));
    } else {
      setError('Não foi possível obter a cotação. Insira o preço manualmente.');
    }
  }, [ticker]);

  // ---------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const qty = quantity ? parseNum(quantity) : undefined;
    const avg = avgPrice ? parseNum(avgPrice) : undefined;
    const mkt = currentPrice ? parseNum(currentPrice) : undefined;

    const invested = effectiveInvested;
    const current = effectiveCurrent;

    if (!ticker.trim()) return setError('Informe o ticker ou nome do ativo.');
    if (!categoryId) return setError('Selecione a subclasse.');
    if (isNaN(invested) || invested < 0) return setError('Informe o custo total ou o PME + quantidade.');
    if (isNaN(current) || current < 0) return setError('Informe o valor atual ou o preço de mercado + quantidade.');

    onSave({
      strategyId,
      categoryId,
      ticker: ticker.trim().toUpperCase(),
      info: info.trim(),
      investedValue: invested,
      currentValue: current,
      quantity: qty !== undefined && !isNaN(qty) ? qty : undefined,
      avgPrice: avg !== undefined && !isNaN(avg) ? avg : undefined,
      customPrice: mkt !== undefined && !isNaN(mkt) ? mkt : undefined,
      priceMode,
    });
    onClose();
  };

  const hasQty = !isNaN(qtyNum) && qtyNum > 0;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Header */}
        <div className={styles.header}>
          <h2>{asset ? 'Editar Ativo' : 'Adicionar Ativo'}</h2>
          <button id="close-asset-modal" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Ticker */}
          <div className="form-group">
            <label className="label">Ticker / Nome *</label>
            <TickerSearch
              value={ticker}
              onChange={(t, name) => {
                setTicker(t);
                if (name && !info.trim()) setInfo(name);
              }}
            />
          </div>

          {/* Info adicional */}
          <div className="form-group">
            <label className="label" htmlFor="asset-info">Informação adicional</label>
            <input
              id="asset-info"
              className="input"
              placeholder="Ex: BlackRock, Banco do Brasil"
              value={info}
              onChange={e => setInfo(e.target.value)}
            />
          </div>

          {/* Classe / Subclasse */}
          <div className={styles.twoCol}>
            <div className="form-group">
              <label className="label" htmlFor="asset-class">Classe *</label>
              <select
                id="asset-class"
                className={`input ${styles.selectInput}`}
                value={selectedClass}
                onChange={handleClassChange}
              >
                {uniqueClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="asset-category">Subclasse *</label>
              <select
                id="asset-category"
                className={`input ${styles.selectInput}`}
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                {asset && !categories.some(c => c.id === categoryId) && (
                  <option value={categoryId} disabled>(Categoria Órfã)</option>
                )}
                {filteredSubclasses.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.subclassName} (Meta: {cat.targetPercent.toFixed(2)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Seção de Preços ─────────────────────────── */}
          <div className={styles.sectionDivider}>
            <span>Posição</span>
          </div>

          {/* Quantidade + Preço Médio (PME) */}
          <div className={styles.twoCol}>
            <div className="form-group">
              <label className="label" htmlFor="asset-qty">Quantidade</label>
              <input
                id="asset-qty"
                className="input"
                placeholder="Ex: 100"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                autoComplete="off"
                inputMode="decimal"
              />
            </div>
            <div className="form-group">
              <label className={`label ${styles.labelWithHint}`} htmlFor="asset-avgprice">
                <span>Preço Médio — PME</span>
                <span className={styles.labelHint}>custo por ação</span>
              </label>
              <input
                id="asset-avgprice"
                className="input"
                placeholder="0,00"
                value={avgPrice}
                onChange={e => setAvgPrice(e.target.value)}
                autoComplete="off"
                inputMode="decimal"
              />
            </div>
          </div>

          {/* Custo Total — derivado ou manual */}
          <div className="form-group">
            <label className={`label ${styles.labelWithHint}`} htmlFor="asset-invested">
              <span>Custo Total (R$) *</span>
              {derivedInvested !== null && (
                <span className={styles.derivedBadge}>
                  <Calculator size={10} /> calculado automaticamente
                </span>
              )}
            </label>
            <input
              id="asset-invested"
              className={`input ${derivedInvested !== null ? styles.derivedInput : ''}`}
              placeholder={hasQty ? 'Preenchido pelo PME acima' : '0,00'}
              value={derivedInvested !== null ? fmtNum(derivedInvested) : manualInvested}
              onChange={e => { if (derivedInvested === null) setManualInvested(e.target.value); }}
              readOnly={derivedInvested !== null}
              autoComplete="off"
              inputMode="decimal"
            />
          </div>

          <div className={styles.sectionDivider}>
            <span>Cotação atual</span>
          </div>

          {/* Preço de Mercado + Valor Atual */}
          <div className={styles.twoCol}>
            <div className="form-group">
              <label className={`label ${styles.labelWithHint}`} htmlFor="asset-price">
                <span>Preço de Mercado</span>
                <div className={styles.priceModeRow}>
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${priceMode === 'auto' ? styles.modeBtnActive : ''}`}
                    onClick={() => setPriceMode('auto')}
                    title="Preço atualizado automaticamente pela Brapi"
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${priceMode === 'manual' ? styles.modeBtnActive : ''}`}
                    onClick={() => setPriceMode('manual')}
                    title="Preço inserido manualmente"
                  >
                    Manual
                  </button>
                  {priceMode === 'auto' && (
                    <button
                      type="button"
                      onClick={handleFetchPrice}
                      disabled={isFetchingPrice || !ticker}
                      className={styles.autoBtn}
                    >
                      <RefreshCw size={11} className={isFetchingPrice ? styles.spin : ''} />
                    </button>
                  )}
                </div>
              </label>
              <input
                id="asset-price"
                className="input"
                placeholder={priceMode === 'auto' ? 'Atualizado automaticamente' : '0,00'}
                value={currentPrice}
                onChange={e => { if (priceMode === 'manual') setCurrentPrice(e.target.value); }}
                readOnly={priceMode === 'auto'}
                style={priceMode === 'auto' ? { cursor: 'default', opacity: 0.7 } : {}}
                autoComplete="off"
                inputMode="decimal"
              />
            </div>
            <div className="form-group">
              <label className={`label ${styles.labelWithHint}`} htmlFor="asset-current">
                <span>Valor Atual (R$) *</span>
                {derivedCurrent !== null && (
                  <span className={styles.derivedBadge}>
                    <Calculator size={10} /> calculado
                  </span>
                )}
              </label>
              <input
                id="asset-current"
                className={`input ${derivedCurrent !== null ? styles.derivedInput : ''}`}
                placeholder={hasQty ? 'Preenchido pelo preço acima' : '0,00'}
                value={derivedCurrent !== null ? fmtNum(derivedCurrent) : manualCurrent}
                onChange={e => { if (derivedCurrent === null) setManualCurrent(e.target.value); }}
                readOnly={derivedCurrent !== null}
                autoComplete="off"
                inputMode="decimal"
              />
            </div>
          </div>

          {/* ────────────────────────────────────────────── */}

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.footer}>
            <button type="button" id="cancel-asset-modal" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" id="save-asset-btn" className="btn btn-primary">
              {asset ? 'Salvar alterações' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
