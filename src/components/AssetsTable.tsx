'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AssetWithCalcs } from '@/types';
import { formatCurrency, formatPercent, formatPercentAbs } from '@/lib/calculations';
import styles from './AssetsTable.module.css';
import { Pencil, Trash2, ArrowUp, ArrowDown, Minus, RefreshCw, AlertCircle, PlusCircle, GripVertical, Info, History, ChevronDown, ChevronRight, TrendingUp, ChevronsUpDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TransactionModal from './TransactionModal';
import AssetHistoryDrawer from './AssetHistoryDrawer';

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

type SortField = 'ticker' | 'currentValue' | 'profitLoss' | 'rebalanceAmount' | null;

function getDeviationColor(current: number, target: number): string {
  if (target === 0) return 'var(--color-text-3)';
  const deviation = Math.abs((current - target) / target);
  if (deviation <= 0.1) return 'var(--color-success)';
  if (deviation <= 0.3) return '#F59E0B';
  return 'var(--color-danger)';
}

export default function AssetsTable({ assets, onEdit, onDelete, onUpdateValue }: Props) {
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [transactionAssetId, setTransactionAssetId] = useState<string | null>(null);
  const [historyAssetId, setHistoryAssetId] = useState<string | null>(null);

  // Ordenação por coluna
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Collapse de grupos
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Group and reorder logic
  const [classOrder, setClassOrder] = useState<string[]>([]);
  const [draggedClass, setDraggedClass] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('investmap_class_order');
    if (saved) {
      try {
        setClassOrder(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved class order', e);
      }
    }
  }, []);

  const groupedAssets = useMemo(() => {
    const map = new Map<string, {
      className: string;
      subclassTargets: Map<string, number>;
      assets: AssetWithCalcs[];
      totalInvestedValue: number;
      totalValue: number;
      totalPercent: number;
      totalRebalance: number;
      groupAction: 'buy' | 'sell' | 'ok';
    }>();

    assets.forEach((a) => {
      const cls = a.category.className;
      if (!map.has(cls)) {
        map.set(cls, {
          className: cls,
          subclassTargets: new Map(),
          assets: [],
          totalInvestedValue: 0,
          totalValue: 0,
          totalPercent: 0,
          totalRebalance: 0,
          groupAction: 'ok',
        });
      }
      const g = map.get(cls)!;
      g.assets.push(a);
      g.subclassTargets.set(a.category.id, a.category.targetPercent);
      g.totalInvestedValue += a.investedValue;
      g.totalValue += a.currentValue;
      g.totalPercent += a.currentPortfolioPercent;
      g.totalRebalance += a.rebalanceAmount;
    });

    map.forEach((g) => {
      // Ordena os ativos dentro do grupo por Ticker (alfabético)
      g.assets.sort((a, b) => a.ticker.localeCompare(b.ticker));

      if (g.totalRebalance > 10) g.groupAction = 'buy';
      else if (g.totalRebalance < -10) g.groupAction = 'sell';
      else g.groupAction = 'ok';
    });

    return Array.from(map.values()).map(g => {
      let totalTargetPercent = 0;
      g.subclassTargets.forEach(val => totalTargetPercent += val);
      return {
        ...g,
        targetPercent: totalTargetPercent,
      }
    });
  }, [assets]);

  const orderedGroups = useMemo(() => {
    if (classOrder.length === 0) {
      return [...groupedAssets].sort((a, b) => a.className.localeCompare(b.className));
    }
    return [...groupedAssets].sort((a, b) => {
      const idxA = classOrder.indexOf(a.className);
      const idxB = classOrder.indexOf(b.className);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [groupedAssets, classOrder]);

  // Aplica ordenação por coluna dentro de cada grupo
  const sortedGroups = useMemo(() => {
    if (!sortField) return orderedGroups;
    return orderedGroups.map(group => ({
      ...group,
      assets: [...group.assets].sort((a, b) => {
        let valA: number | string = 0;
        let valB: number | string = 0;
        switch (sortField) {
          case 'ticker':         valA = a.ticker;           valB = b.ticker;           break;
          case 'currentValue':   valA = a.currentValue;     valB = b.currentValue;     break;
          case 'profitLoss':     valA = a.profitLoss;       valB = b.profitLoss;       break;
          case 'rebalanceAmount':valA = a.rebalanceAmount;  valB = b.rebalanceAmount;  break;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortDir === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      }),
    }));
  }, [orderedGroups, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown size={12} className={styles.sortIconInactive} />;
    return sortDir === 'asc'
      ? <ArrowUp size={12} className={styles.sortIconActive} />
      : <ArrowDown size={12} className={styles.sortIconActive} />;
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, className: string) => {
    setDraggedClass(className);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', className);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetClassName: string) => {
    e.preventDefault();
    if (!draggedClass || draggedClass === targetClassName) {
      setDraggedClass(null);
      return;
    }

    const currentOrder = classOrder.length > 0 ? classOrder : groupedAssets.map(g => g.className);
    const newOrder = [...currentOrder];

    if (!newOrder.includes(draggedClass)) newOrder.push(draggedClass);
    if (!newOrder.includes(targetClassName)) newOrder.push(targetClassName);

    const oldIndex = newOrder.indexOf(draggedClass);
    newOrder.splice(oldIndex, 1);

    const newIndex = newOrder.indexOf(targetClassName);
    newOrder.splice(newIndex, 0, draggedClass);

    setClassOrder(newOrder);
    localStorage.setItem('investmap_class_order', JSON.stringify(newOrder));
    setDraggedClass(null);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleGroup = (className: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
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
        <TrendingUp size={48} strokeWidth={1.25} style={{ color: 'var(--color-primary-light)', opacity: 0.6 }} />
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

      <div className={styles.tableWrapper}>
        <table>
          <thead>
            <tr>
              <th
                className={styles.sortableHeader}
                onClick={() => handleSort('ticker')}
                title="Ordenar por ticker"
              >
                <span>Ativo</span><SortIcon field="ticker" />
              </th>
              <th className={styles.right}>Investido</th>
              <th
                className={`${styles.right} ${styles.sortableHeader}`}
                onClick={() => handleSort('currentValue')}
                title="Ordenar por valor atual"
              >
                <span>Atual</span><SortIcon field="currentValue" />
              </th>
              <th
                className={`${styles.right} ${styles.sortableHeader}`}
                onClick={() => handleSort('profitLoss')}
                title="Ordenar por lucro/prejuízo"
              >
                <span>Lucro/Prejuízo</span><SortIcon field="profitLoss" />
              </th>
              <th className={styles.right}>% Alvo</th>
              <th className={styles.right}>% Carteira</th>
              <th
                className={`${styles.right} ${styles.sortableHeader}`}
                onClick={() => handleSort('rebalanceAmount')}
                title="Ordenar por valor a rebalancear"
              >
                <span>Rebalancear</span><SortIcon field="rebalanceAmount" />
              </th>
              <th>Status</th>
              <th className={styles.center}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map((group) => (
              <React.Fragment key={group.className}>
                {/* Cabeçalho do Grupo (Classe) — com métricas agregadas */}
                <tr
                  className={styles.groupHeader}
                  draggable
                  onDragStart={(e) => handleDragStart(e, group.className)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, group.className)}
                  onDragEnd={() => setDraggedClass(null)}
                >
                  {/* Nome do grupo — colspan 2 (Ativo + Investido) */}
                  <td colSpan={2}>
                    <div className={styles.groupHeaderContent}>
                      <button
                        className={styles.collapseBtn}
                        onClick={(e) => { e.stopPropagation(); toggleGroup(group.className); }}
                        title={collapsedGroups.has(group.className) ? 'Expandir grupo' : 'Recolher grupo'}
                        aria-label={collapsedGroups.has(group.className) ? 'Expandir grupo' : 'Recolher grupo'}
                      >
                        {collapsedGroups.has(group.className)
                          ? <ChevronRight size={14} />
                          : <ChevronDown size={14} />
                        }
                      </button>
                      <span title="Arraste para reordenar os grupos" aria-label="Arraste para reordenar os grupos">
                        <GripVertical size={16} className={styles.dragIcon} />
                      </span>
                      <span className={styles.groupHeaderTitle}>{group.className}</span>
                      {collapsedGroups.has(group.className) && (
                        <span className={styles.collapsedCount}>{group.assets.length} ativo{group.assets.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </td>

                  {/* Valor atual total do grupo */}
                  <td className={`${styles.right} ${styles.groupMeta}`}>
                    <div className={styles.groupTotal}>
                      <span className={styles.groupLabel}>Patrimônio: </span>
                      {formatCurrency(group.totalValue)}
                    </div>
                  </td>

                  {/* Lucro/Prejuízo — vazio no grupo */}
                  <td />

                  {/* % Alvo do grupo */}
                  <td className={`${styles.right} ${styles.groupTarget}`}>
                    {formatPercentAbs(group.targetPercent)}
                  </td>

                  {/* % Carteira atual do grupo */}
                  <td className={`${styles.right} ${styles.groupMeta}`}>
                    <div className={styles.groupTotal}>
                      <span className={styles.groupLabel}>Atual: </span>
                      {formatPercentAbs(group.totalPercent)}
                    </div>
                  </td>

                  {/* Rebalancear total do grupo */}
                  <td className={`${styles.right} ${styles.groupMeta} ${group.totalRebalance > 0 ? styles.profit : group.totalRebalance < 0 ? styles.loss : styles.muted}`}>
                    {group.totalRebalance >= 0 ? '+' : ''}{formatCurrency(group.totalRebalance)}
                  </td>

                  {/* Status do grupo */}
                  <td>
                    <ActionBadge action={group.groupAction} />
                  </td>

                  {/* Ações — vazio no cabeçalho */}
                  <td />
                </tr>

                {/* Ativos dentro do Grupo — apenas se não estiver colapsado */}
                {!collapsedGroups.has(group.className) && group.assets.map((asset) => (
                  <tr key={asset.id} className={`${styles.row} ${styles[`row_${asset.action}`]}`}>
                    {/* Ativo */}
                    <td>
                      <div className={styles.tickerCell}>
                        <span className={styles.ticker}>{asset.ticker}</span>
                        {asset.info && (
                          <span className={styles.info}>
                            {asset.info.length > 35 ? (
                              <span title={asset.info} className={styles.truncatedInfo}>
                                {asset.info.slice(0, 32).trim()}... 
                                <Info size={11} className={styles.infoIcon} />
                              </span>
                            ) : (
                              asset.info
                            )}
                          </span>
                        )}
                        {asset.createdAt && (
                          <span className={styles.info} style={{ fontSize: '0.65rem' }}>
                            {formatDistanceToNow(new Date(asset.createdAt), { locale: ptBR })} na carteira
                          </span>
                        )}
                        <span className={styles.subclassBadge}>{asset.category.subclassName}</span>
                      </div>
                    </td>

                    {/* Investido */}
                    <td className={styles.right}>{formatCurrency(asset.investedValue)}</td>

                    {/* Atual (editável inline) */}
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
                            title="Clique para atualizar o valor atual"
                            id={`current-value-${asset.id}`}
                          >
                            {formatCurrency(asset.currentValue)}
                            <RefreshCw size={12} className={styles.editIcon} />
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

                    {/* % Alvo do Ativo */}
                    <td className={styles.center} title={`Meta total da subclasse: ${asset.targetPercent}%`}>
                      <div className={styles.targetCell} style={{ justifyContent: 'center' }}>
                        <span className={styles.muted}>{asset.assetTargetPercent.toFixed(2)}%</span>
                      </div>
                    </td>

                    {/* % Carteira com mini progress bar */}
                    <td className={styles.right}>
                      <div className={styles.percentCell}>
                        <span>{formatPercentAbs(asset.currentPortfolioPercent)}</span>
                        {asset.assetTargetPercent > 0 && (
                          <div className={styles.progressTrack}>
                            <div
                              className={styles.progressFill}
                              style={{
                                width: `${Math.min(100, (asset.currentPortfolioPercent / asset.assetTargetPercent) * 100)}%`,
                                background: getDeviationColor(asset.currentPortfolioPercent, asset.assetTargetPercent),
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>

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

                    {/* Ações — hierarquia: Histórico → Editar → Aporte | Excluir */}
                    <td className={`${styles.center} ${styles.actionsCell}`}>
                      <div className={styles.actions}>
                        <button
                          id={`history-asset-${asset.id}`}
                          className={`btn btn-ghost btn-sm ${styles.actionBtn}`}
                          onClick={() => setHistoryAssetId(asset.id)}
                          title="Ver histórico de transações"
                        >
                          <History size={13} />
                        </button>
                        <button
                          id={`edit-asset-${asset.id}`}
                          className={`btn btn-ghost btn-sm ${styles.actionBtn}`}
                          onClick={() => onEdit(asset)}
                          title="Editar propriedades do ativo"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className={`btn btn-ghost btn-sm ${styles.actionBtn} ${styles.actionBtnTransaction}`}
                          onClick={() => setTransactionAssetId(asset.id)}
                          title="Registrar aporte ou venda"
                        >
                          <PlusCircle size={14} />
                        </button>
                        {/* Separador visual antes do delete */}
                        <span className={styles.actionDivider} />
                        <button
                          id={`delete-asset-${asset.id}`}
                          className={`btn btn-danger btn-sm ${styles.actionBtn}`}
                          onClick={() => handleDeleteClick(asset.id)}
                          title="Excluir ativo"
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

      {/* Drawer de Histórico */}
      {historyAssetId && (
        <AssetHistoryDrawer
          assetId={historyAssetId}
          onClose={() => setHistoryAssetId(null)}
        />
      )}
    </>
  );
}
