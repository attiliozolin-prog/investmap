'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { calculatePortfolio } from '@/lib/calculations';
import AssetsTable from '@/components/AssetsTable';
import AssetModal from '@/components/AssetModal';
import { AssetWithCalcs, Asset } from '@/types';
import styles from './Assets.module.css';
import { Plus } from 'lucide-react';

export default function Assets() {
  const { activeStrategy, activeAssets, activeStrategyId, addAsset, updateAsset, deleteAsset } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const assetsWithCalcs = useMemo<AssetWithCalcs[]>(() => {
    if (!activeStrategy || activeAssets.length === 0) return [];
    try {
      return calculatePortfolio(activeStrategy, activeAssets).assetsWithCalcs;
    } catch {
      return [];
    }
  }, [activeStrategy, activeAssets]);

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
        <button
          id="add-asset-btn"
          className="btn btn-primary"
          onClick={() => { setEditingAsset(null); setShowModal(true); }}
        >
          <Plus size={16} />
          Adicionar Ativo
        </button>
      </div>

      <AssetsTable
        assets={assetsWithCalcs}
        onEdit={handleEdit}
        onDelete={deleteAsset}
        onUpdateValue={(id, val) => updateAsset(id, { currentValue: val })}
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
    </div>
  );
}
