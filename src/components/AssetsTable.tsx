'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AssetWithCalcs } from '@/types';
import { formatCurrency, formatPercent, formatPercentAbs } from '@/lib/calculations';
import styles from './AssetsTable.module.css';
import { Pencil, Trash2, ArrowUp, ArrowDown, Minus, RefreshCw, AlertCircle, PlusCircle, GripVertical } from 'lucide-react';
import TransactionModal from './TransactionModal';

interface Props {
  assets: AssetWithCalcs[];
  onEdit: (asset: AssetWithCalcs) => void;
  onDelete: (id: string) => void;
  onUpdateValue: (id: string, currentValue: number) => void;
}

function ActionBadge({ action }: { action: 'buy' | 'sell' | 'ok' }) {
  if (action === 'buy')
    return (
      <span className={`badge badge-success ${styles.actionBadge}`}>
        <ArrowUp size={10} /> Comprar
      </span>
    );
  if (action === 'sell')
    return (
      <span className={`badge badge-danger ${styles.actionBadge}`}>
        <ArrowDown size={10} /> Vender
      </span>
    );
  return (
    <span className={`badge badge-neutral ${styles.actionBadge}`}>
      <Minus size={10} /> OK
    </span>
  );
}

// Calcula quantos dias se passaram desde a última atualização
function daysSince(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function StaleValueBadge({ updatedAt }: { updatedAt: string }) {
  const days = daysSince(updatedAt);
  if (days < 7) return null;
  return (
    <span className={styles.staleBadge} title={`Última atualização há ${days} dias`}>
      <AlertCircle size={10} />
      {days}d
    </span>
  );
}

export default function AssetsTable({ assets, onEdit, onDelete, onUpdateValue }: Props) {
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [transactionAssetId, setTransactionAssetId] = useState<string | null>(null);

  // Group and reorder logic
  const [subclassOrder, setSubclassOrder] = useState<string[]>([]);
  const [draggedSubclass, setDraggedSubclass] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('investmap_subclass_order');
    if (saved) {
      try {
        setSubclassOrder(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved subclass order', e);
      }
    }
  }, []);

  const groupedAssets = useMemo(() => {
    const map = new Map<string, { subclassName: string; targetPercent: number; assets: AssetWithCalcs[] }>();
    assets.forEach((a) => {
      const subclass = a.category.subclassName;
      if (!map.has(subclass)) {
        map.set(subclass, { subclassName: subclass, targetPercent: a.targetPercent, assets: [] });
      }
      map.get(subclass)!.assets.push(a);
    });
    return Array.from(map.values());
  }, [assets]);

  const orderedGroups = useMemo(() => {
    if (subclassOrder.length === 0) return groupedAssets;
    return [...groupedAssets].sort((a, b) => {
      const idxA = subclassOrder.indexOf(a.subclassName);
      const idxB = subclassOrder.indexOf(b.subclassName);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [groupedAssets, subclassOrder]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, subclassName: string) => {
    setDraggedSubclass(subclassName);
    e.dataTransfer.effectAllowed = 'move';
    // Define um valor inútil, o estado React lidará com a lógica
    e.dataTransfer.setData('text/plain', subclassName); 
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetSubclassName: string) => {
    e.preventDefault();
    if (!draggedSubclass || draggedSubclass === targetSubclassName) {
      setDraggedSubclass(null);
      return;
    }

    const currentOrder = subclassOrder.length > 0 ? subclassOrder : groupedAssets.map(g => g.subclassName);
    const newOrder = [...currentOrder];
    
    if(!newOrder.includes(draggedSubclass)) newOrder.push(draggedSubclass);
    if(!newOrder.includes(targetSubclassName)) newOrder.push(targetSubclassName);

    const oldIndex = newOrder.indexOf(draggedSubclass);
    newOrder.splice(oldIndex, 1);
    
    const newIndex = newOrder.indexOf(targetSubclassName);
    newOrder.splice(newIndex, 0, draggedSubclass);
    
    setSubclassOrder(newOrder);
    localStorage.setItem('investmap_subclass_order', JSON.stringify(newOrder));
    setDraggedSubclass(null);
  };

  const startEditValue = (asset: AssetWithCalcs) => {
    setEditingValueId(asset.id);
    setEditingValue(asset.currentValue.toFixed(2).replace('.', ','));
  };

  const confirmEditValue = (id: string) => {
    const parsed = parseFloat(editingValue.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateValue(id, parsed);
    }
    setEditingValueId(null);
  };

  const handleDeleteClick = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleDeleteConfirm = () => {
    if (confirmDeleteId) {
      onDelete(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  if (assets.length === 0) {
    return (
      <div className="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3h18v18H3zM16 8l-4 4-4-4" />
        </svg>
        <h3>Nenhum ativo cadastrado</h3>
        <p>Clique em &quot;Adicionar Ativo&quot; para começar a montar sua carteira.</p>
      </div>
    );
  }

  return (
    <>
      {/* Modal de confirmação de delete */}
      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className={`modal ${styles.confirmModal}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <Trash2 size={22} />
            </div>
            <h3 className={styles.confirmTitle}>Remover ativo?</h3>
            <p className={styles.confirmText}>
              Esta ação não pode ser desfeita. O ativo{' '}
              <strong>{assets.find((a) => a.id === confirmDeleteId)?.ticker}</strong> será removido da sua carteira.
            </p>
            <div className={styles.confirmActions}>
              <button className="btn btn-ghost" onClick={() => setConfirmDeleteId(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm} id="confirm-delete-btn">
                <Trash2 size={14} /> Remover
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Ativo</th>
              <th>Subclasse</th>
              <th className={styles.right}>Investido</th>
              <th className={styles.right}>Atual</th>
              <th className={styles.right}>Lucro/Prejuízo</th>
              <th className={styles.right}>% Alvo</th>
              <th className={styles.right}>% Carteira</th>
              <th className={styles.right}>Rebalancear</th>
              <th>Status</th>
              <th className={styles.center}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {orderedGroups.map((group) => (
              <React.Fragment key={group.subclassName}>
                {/* Cabeçalho do Grupo (Subclasse) */}
                <tr 
                  className={styles.groupHeader}
                  draggable
                  onDragStart={(e) => handleDragStart(e, group.subclassName)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, group.subclassName)}
                  onDragEnd={() => setDraggedSubclass(null)}
                >
                  <td colSpan={5}>
                    <div className={styles.groupHeaderContent}>
                      <GripVertical size={16} className={styles.dragIcon} />
                      <span className={styles.groupHeaderTitle}>{group.subclassName}</span>
                    </div>
                  </td>
                  <td className={`${styles.right} ${styles.groupTarget}`}>
                    {formatPercentAbs(group.targetPercent)}
                  </td>
                  <td colSpan={4}></td>
                </tr>

                {/* Ativos dentro do Grupo */}
                {group.assets.map((asset) => (
                  <tr key={asset.id} className={`${styles.row} ${styles[`row_${asset.action}`]}`}>
                    {/* Ativo */}
                    <td>
                      <div className={styles.tickerCell}>
                        <span className={styles.ticker}>{asset.ticker}</span>
                        {asset.info && <span className={styles.info}>{asset.info}</span>}
                      </div>
                    </td>

                    {/* Subclasse - Agora vazia ou com um traço estético já que está agrupada */}
                    <td className={styles.muted} style={{ paddingLeft: '24px' }}>
                      <span style={{ opacity: 0.3 }}>&mdash;</span>
                    </td>

                    {/* Investido */}
                    <td className={styles.right}>{formatCurrency(asset.investedValue)}</td>

                    {/* Atual (editável) */}
                    <td className={styles.right}>
                      {editingValueId === asset.id ? (
                        <div className={styles.inlineEdit}>
                          <input
                            id={`edit-value-${asset.id}`}
                            className={styles.inlineInput}
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmEditValue(asset.id);
                              if (e.key === 'Escape') setEditingValueId(null);
                            }}
                            autoFocus
                          />
                          <button className={styles.confirmBtn} onClick={() => confirmEditValue(asset.id)}>✓</button>
                        </div>
                      ) : (
                        <div className={styles.currentValueCell}>
                          <button
                            className={styles.valueBtn}
                            onClick={() => startEditValue(asset)}
                            title="Clique para atualizar"
                            id={`current-value-${asset.id}`}
                          >
                            {formatCurrency(asset.currentValue)}
                            <RefreshCw size={10} className={styles.editIcon} />
                          </button>
                          <StaleValueBadge updatedAt={asset.updatedAt} />
                        </div>
                      )}
                    </td>

                    {/* Lucro/Prejuízo */}
                    <td className={styles.right}>
                      <div className={`${styles.profitLoss} ${asset.profitLoss >= 0 ? styles.profit : styles.loss}`}>
                        <span>{formatCurrency(asset.profitLoss)}</span>
                        <span className={styles.profitPercent}>({formatPercent(asset.profitLossPercent)})</span>
                      </div>
                    </td>

                    {/* % Alvo - Vazio no ativo pois pertence ao grupo */}
                    <td className={`${styles.right} ${styles.muted}`}>
                      <span style={{ opacity: 0.3 }}>&mdash;</span>
                    </td>

                    {/* % Carteira */}
                    <td className={styles.right}>{formatPercentAbs(asset.currentPortfolioPercent)}</td>

                    {/* Rebalancear */}
                    <td className={`${styles.right} ${styles.rebalance}`}>
                      <span className={asset.rebalanceAmount > 0 ? styles.profit : asset.rebalanceAmount < 0 ? styles.loss : styles.muted}>
                        {asset.rebalanceAmount >= 0 ? '+' : ''}{formatCurrency(asset.rebalanceAmount)}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <ActionBadge action={asset.action} />
                    </td>

                    {/* Ações */}
                    <td className={styles.center}>
                      <div className={styles.actions}>
                        <button
                          className={`btn btn-ghost btn-sm ${styles.actionBtn}`}
                          onClick={() => setTransactionAssetId(asset.id)}
                          title="Registrar Aporte / Venda"
                        >
                          <PlusCircle size={14} />
                        </button>
                        <button
                          id={`edit-asset-${asset.id}`}
                          className={`btn btn-ghost btn-sm ${styles.actionBtn}`}
                          onClick={() => onEdit(asset)}
                          title="Editar Propriedades"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          id={`delete-asset-${asset.id}`}
                          className={`btn btn-danger btn-sm ${styles.actionBtn}`}
                          onClick={() => handleDeleteClick(asset.id)}
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Transação */}
      {transactionAssetId && (
        <TransactionModal
          assetId={transactionAssetId}
          onClose={() => setTransactionAssetId(null)}
        />
      )}
    </>
  );
}
