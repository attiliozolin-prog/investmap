'use client';

import { useState, useEffect, useRef } from 'react';
import { Asset, StrategyCategory } from '@/types';
import styles from './AssetModal.module.css';
import { X, RefreshCw } from 'lucide-react';
import TickerSearch from './TickerSearch';
import { fetchAssetPrice } from '@/lib/brapi';

interface Props {
  categories: StrategyCategory[];
  strategyId: string;
  asset?: Asset | null;
  onSave: (data: Omit<Asset, 'id' | 'updatedAt'>) => void;
  onClose: () => void;
}

export default function AssetModal({ categories, strategyId, asset, onSave, onClose }: Props) {
  const [ticker, setTicker] = useState('');
  const [info, setInfo] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [investedValue, setInvestedValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [error, setError] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const currentInputRef = useRef<HTMLInputElement>(null);

  const uniqueClasses = Array.from(new Set(categories.map((c) => c.className)));
  const [selectedClass, setSelectedClass] = useState<string>('');

  useEffect(() => {
    if (asset) {
      setTicker(asset.ticker);
      setInfo(asset.info);
      setCategoryId(asset.categoryId);
      
      const matchedCat = categories.find(c => c.id === asset.categoryId);
      if (matchedCat) {
        setSelectedClass(matchedCat.className);
      }
      
      setInvestedValue(asset.investedValue.toFixed(2).replace('.', ','));
      setCurrentValue(asset.currentValue.toFixed(2).replace('.', ','));
      if (asset.quantity) setQuantity(asset.quantity.toString().replace('.', ','));
      if (asset.customPrice) setPrice(asset.customPrice.toFixed(2).replace('.', ','));

      // Auto-foco inteligente ao editar
      setTimeout(() => {
        if (currentInputRef.current) {
          currentInputRef.current.focus();
          currentInputRef.current.select();
        }
      }, 100);
    } else if (categories.length > 0) {
      const initialClass = uniqueClasses.length > 0 ? uniqueClasses[0] : '';
      setSelectedClass(initialClass);
      
      const initialSubclasses = categories.filter(c => c.className === initialClass);
      if (initialSubclasses.length > 0) {
        setCategoryId(initialSubclasses[0].id);
      }
    }
  }, [asset, categories]);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClass = e.target.value;
    setSelectedClass(newClass);
    const availableSubclasses = categories.filter(c => c.className === newClass);
    if (availableSubclasses.length > 0) {
      setCategoryId(availableSubclasses[0].id);
    } else {
      setCategoryId('');
    }
  };

  const filteredSubclasses = categories.filter((c) => c.className === selectedClass);

  const parseNum = (v: string) => parseFloat(v.replace(',', '.'));

  const handleFetchPrice = async () => {
    if (!ticker) return;
    setIsFetchingPrice(true);
    const fetchedPrice = await fetchAssetPrice(ticker);
    setIsFetchingPrice(false);
    if (fetchedPrice) {
      setPrice(fetchedPrice.toFixed(2).replace('.', ','));
      const qty = parseNum(quantity);
      if (!isNaN(qty) && qty > 0) {
        setCurrentValue((qty * fetchedPrice).toFixed(2).replace('.', ','));
      }
    } else {
      setError('Não foi possível obter a cotação. Insira o preço manualmente.');
    }
  };

  // Atualiza o valor atual automaticamente se quantidade e preço estiverem preenchidos
  useEffect(() => {
    const q = parseNum(quantity);
    const p = parseNum(price);
    if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
      setCurrentValue((q * p).toFixed(2).replace('.', ','));
    }
  }, [quantity, price]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const invested = parseNum(investedValue);
    const current = parseNum(currentValue);
    const qty = quantity ? parseNum(quantity) : undefined;
    const prc = price ? parseNum(price) : undefined;

    if (!ticker.trim()) return setError('Informe o ticker ou nome do ativo.');
    if (!categoryId) return setError('Selecione a subclasse.');
    if (isNaN(invested) || invested < 0) return setError('Valor investido inválido.');
    if (isNaN(current) || current < 0) return setError('Valor atual inválido.');

    onSave({
      strategyId,
      categoryId,
      ticker: ticker.trim().toUpperCase(),
      info: info.trim(),
      investedValue: invested,
      currentValue: current,
      quantity: !isNaN(qty as number) ? qty : undefined,
      customPrice: !isNaN(prc as number) ? prc : undefined,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Header */}
        <div className={styles.header}>
          <h2>{asset ? 'Editar Ativo' : 'Adicionar Ativo'}</h2>
          <button id="close-asset-modal" className={`btn btn-ghost btn-sm`} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Ticker / Nome *</label>
            <TickerSearch
              value={ticker}
              onChange={(t, name) => {
                setTicker(t);
                // Preenche Info automaticamente se estiver vazio
                if (name && !info.trim()) setInfo(name);
              }}
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="asset-info">Informação adicional</label>
            <input
              id="asset-info"
              className="input"
              placeholder="Ex: BlackRock, Banco do Brasil"
              value={info}
              onChange={(e) => setInfo(e.target.value)}
            />
          </div>

          <div className={styles.twoCol}>
            <div className="form-group">
              <label className="label" htmlFor="asset-class">Classe *</label>
              <select
                id="asset-class"
                className={`input ${styles.selectInput}`}
                value={selectedClass}
                onChange={handleClassChange}
              >
                {uniqueClasses.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label" htmlFor="asset-category">Subclasse *</label>
              <select
                id="asset-category"
                className={`input ${styles.selectInput}`}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {asset && !categories.some(c => c.id === categoryId) && (
                  <option value={categoryId} disabled>
                    (Categoria Órfã)
                  </option>
                )}
                {filteredSubclasses.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.subclassName} (Meta: {cat.targetPercent.toFixed(2)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.twoCol}>
            <div className="form-group">
              <label className="label" htmlFor="asset-qty">Quantidade (opcional)</label>
              <input
                id="asset-qty"
                className="input"
                placeholder="Ex: 100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="asset-price" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Preço Atual (R$)</span>
                <button type="button" onClick={handleFetchPrice} disabled={isFetchingPrice || !ticker} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: 0 }}>
                  <RefreshCw size={12} className={isFetchingPrice ? styles.spin : ''} /> Auto
                </button>
              </label>
              <input
                id="asset-price"
                className="input"
                placeholder="0,00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className={styles.twoCol}>
            <div className="form-group">
              <label className="label" htmlFor="asset-invested">Valor Total Investido (R$) *</label>
              <input
                id="asset-invested"
                className="input"
                placeholder="0,00"
                value={investedValue}
                onChange={(e) => setInvestedValue(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="asset-current">Valor Total Atual (R$) *</label>
              <input
                id="asset-current"
                ref={currentInputRef}
                className="input"
                placeholder="0,00"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

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
