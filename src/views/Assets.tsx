'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { calculatePortfolio } from '@/lib/calculations';
import AssetsTable from '@/components/AssetsTable';
import AssetModal from '@/components/AssetModal';
import { AssetWithCalcs, Asset } from '@/types';
import styles from './Assets.module.css';
import { Plus, Search, X, BookOpen } from 'lucide-react';
import PortfolioHistory from '@/components/PortfolioHistory';

export default function Assets() {
  const { activeStrategy, activeAssets, activeStrategyId, addAsset, updateAsset, deleteAsset } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);

  const assetsWithCalcs = useMemo<AssetWithCalcs[]>(() => {
    if (!activeStrategy || activeAssets.length === 0) return [];
    try {
      return calculatePortfolio(activeStrategy, activeAssets).assetsWithCalcs;
    } catch {
      return [];
    }
  }, [activeStrategy, activeAssets]);

  // Classes únicas para os chips de filtro
  const classNames = useMemo(() => {
    const set = new Set<string>();
    assetsWithCalcs.forEach(a => set.add(a.category.className));
    return Array.from(set).sort();
  }, [assetsWithCalcs]);

  // Aplica filtros de busca, classe e ação
  const filteredAssets = useMemo(() => {
    let result = assetsWithCalcs;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.ticker.toLowerCase().includes(q) ||
        (a.info && a.info.toLowerCase().includes(q))
      );
    }
    if (filterClass) {
      result = result.filter(a => a.category.className === filterClass);
    }
    if (filterAction) {
      result = result.filter(a => a.action === filterAction);
    }
    return result;
  }, [assetsWithCalcs, searchQuery, filterClass, filterAction]);

  const isFiltering = !!(searchQuery.trim() || filterClass || filterAction);

  const handleEdit = (asset: AssetWithCalcs) => {
    setEditingAsset(asset);
    setShowModal(true);
  };

  const handleSave = (data: Omit<Asset, 'id' | 'updatedAt'>) => {
    if (editingAsset) {
      updateAsset(editingAsset.id, data);
    } else {
      addAsset(data);
    }
    setEditingAsset(null);
    setShowModal(false);
  };

  const handleArchiveToggle = (asset: AssetWithCalcs) => {
    const isArchived = asset.isArchived ?? false;
    let newInfo = asset.info || '';
    if (isArchived) {
      newInfo = newInfo.replace('[[ARCHIVED]]', '').trim();
    } else {
      newInfo = `[[ARCHIVED]] ${newInfo}`.trim();
    }
    updateAsset(asset.id, { info: newInfo });
  };

  if (!activeStrategy) {
    return (
      <div className="empty-state">
        <h3>Nenhuma estratégia ativa</h3>
        <p>Vá para a aba Estratégia para configurar sua carteira.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2>Ativos</h2>
          <p style={{ marginTop: 4 }}>{activeAssets.length} ativo{activeAssets.length !== 1 ? 's' : ''} nesta carteira</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowHistory(true)}
            title="Ver histórico geral, IR e compensações"
          >
            <BookOpen size={16} />
            Histórico Geral
          </button>
          <button
            id="add-asset-btn"
            className="btn btn-primary"
            onClick={() => { setEditingAsset(null); setShowModal(true); }}
          >
            <Plus size={16} />
            Adicionar Ativo
          </button>
        </div>
      </div>

      {/* Barra de busca e filtros */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrapper}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por ticker ou nome..."
            className={styles.searchInput}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Buscar ativo"
          />
          {searchQuery && (
            <button className={styles.clearSearch} onClick={() => setSearchQuery('')} aria-label="Limpar busca">
              <X size={13} />
            </button>
          )}
        </div>

        <div className={styles.chips}>
          {classNames.map(cls => (
            <button
              key={cls}
              className={`${styles.chip} ${filterClass === cls ? styles.chipActive : ''}`}
              onClick={() => setFilterClass(prev => prev === cls ? null : cls)}
            >
              {cls}
            </button>
          ))}
          <button
            className={`${styles.chip} ${styles.chipBuy} ${filterAction === 'buy' ? styles.chipActive : ''}`}
            onClick={() => setFilterAction(prev => prev === 'buy' ? null : 'buy')}
          >
            ↑ Comprar
          </button>
          <button
            className={`${styles.chip} ${styles.chipSell} ${filterAction === 'sell' ? styles.chipActive : ''}`}
            onClick={() => setFilterAction(prev => prev === 'sell' ? null : 'sell')}
          >
            ↓ Vender
          </button>
        </div>

        {isFiltering && (
          <button
            className={styles.clearAll}
            onClick={() => { setSearchQuery(''); setFilterClass(null); setFilterAction(null); }}
          >
            <X size={12} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Resultado vazio de filtro */}
      {isFiltering && filteredAssets.length === 0 && (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <p>Nenhum ativo encontrado para os filtros aplicados.</p>
        </div>
      )}

      <AssetsTable
        assets={filteredAssets}
        onEdit={handleEdit}
        onDelete={deleteAsset}
        onUpdateValue={(id, val) => updateAsset(id, { currentValue: val })}
        onArchiveToggle={handleArchiveToggle}
      />

      {showModal && (
        <AssetModal
          categories={activeStrategy.categories}
          strategyId={activeStrategyId}
          asset={editingAsset}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingAsset(null); }}
        />
      )}
      {showHistory && (
        <PortfolioHistory onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}
