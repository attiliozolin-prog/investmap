'use client';

import { useState, useEffect } from 'react';
import { Asset, StrategyCategory } from '@/types';
import styles from './AssetModal.module.css';
import { X } from 'lucide-react';
import TickerSearch from './TickerSearch';

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
  const [investedValue, setInvestedValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [error, setError] = useState('');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const invested = parseNum(investedValue);
    const current = parseNum(currentValue);

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
              <label className="label" htmlFor="asset-invested">Valor Investido (R$) *</label>
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
              <label className="label" htmlFor="asset-current">Valor Atual (R$) *</label>
              <input
                id="asset-current"
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
