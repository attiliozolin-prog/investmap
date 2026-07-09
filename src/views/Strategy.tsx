'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { StrategyCategory } from '@/types';
import { CHART_COLORS } from '@/lib/calculations';
import styles from './Strategy.module.css';
import { Plus, Trash2, CheckCircle, ChevronDown } from 'lucide-react';
import HelpTip from '@/components/HelpTip';
import DeleteStrategyModal from '@/components/DeleteStrategyModal';

export default function Strategy() {
  const {
    activeStrategy, activeStrategyId, updateStrategy, addCategory, updateCategory, deleteCategory, createStrategy, strategies, setActiveStrategy, deleteStrategy,
  } = useApp();

  const [strategyToDelete, setStrategyToDelete] = useState<{ id: string; name: string } | null>(null);
  const [stratName, setStratName] = useState(activeStrategy?.name ?? '');
  const [stratDesc, setStratDesc] = useState(activeStrategy?.description ?? '');
  const [tolerance, setTolerance] = useState(activeStrategy?.deviationTolerance ?? 3);
  
  // Sincroniza campos locais quando a estratégia ativa muda
  useEffect(() => {
    if (activeStrategy) {
      setStratName(activeStrategy.name ?? '');
      setStratDesc(activeStrategy.description ?? '');
      setTolerance(activeStrategy.deviationTolerance ?? 3);
    }
  }, [activeStrategy]);

  // Accordions
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (className: string) => {
    setOpenGroups(p => ({ ...p, [className]: !p[className] }));
  };

  // Add inline por grupo
  const [inlineAddClass, setInlineAddClass] = useState<string | null>(null);
  const [inlineSubclass, setInlineSubclass] = useState('');
  const [inlineTarget, setInlineTarget] = useState('');

  // Micro-animação ao salvar %
  const [savedCatId, setSavedCatId] = useState<string | null>(null);

  const categories = activeStrategy?.categories ?? [];
  const totalTarget = categories.reduce((s, c) => s + c.targetPercent, 0);
  const isValid = Math.abs(totalTarget - 100) < 0.01;

  const groupedCategories = useMemo(() => {
    const groups: Record<string, StrategyCategory[]> = {};
    categories.forEach(c => {
      if (!groups[c.className]) groups[c.className] = [];
      groups[c.className].push(c);
    });
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    );
  }, [categories]);

  // Chart data for Stacked Bar
  const classTotals = useMemo(() => {
    return Object.entries(groupedCategories).map(([className, cats], i) => {
      const targetVal = cats.reduce((sum, c) => sum + c.targetPercent, 0);
      return {
        name: className,
        value: targetVal,
        color: CHART_COLORS[i % CHART_COLORS.length]
      };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [groupedCategories]);

  const handleSaveStrategy = () => {
    if (!activeStrategy) return;
    updateStrategy(activeStrategyId, {
      name: stratName.trim() || 'Minha Carteira',
      description: stratDesc.trim(),
      deviationTolerance: Number(tolerance),
    });
  };

  const handleInlineAdd = () => {
    if (!inlineAddClass) return;
    const target = parseFloat(inlineTarget.replace(',', '.'));
    if (!inlineSubclass.trim() || isNaN(target) || target <= 0 || target > 100) return;
    addCategory({
      className: inlineAddClass,
      subclassName: inlineSubclass.trim(),
      targetPercent: target,
    });
    setInlineSubclass('');
    setInlineTarget('');
    setInlineAddClass(null);
  };

  const handleConfirmDeleteStrategy = (id: string) => {
    deleteStrategy(id);
    setStrategyToDelete(null);
    if (id === activeStrategyId) {
      const remaining = strategies.filter((s) => s.id !== id);
      if (remaining.length > 0) setActiveStrategy(remaining[0].id);
    }
  };

  const handleUpdateCategoryPercent = (id: string, val: string) => {
    const num = parseFloat(val.replace(',', '.'));
    if (!isNaN(num) && num >= 0 && num <= 100) {
      updateCategory(id, { targetPercent: num });
      setSavedCatId(id);
      setTimeout(() => setSavedCatId(null), 1200);
    }
  };
  
  const handleUpdateSubclassName = (id: string, val: string) => {
    const trimmed = val.trim();
    if (trimmed) {
      updateCategory(id, { subclassName: trimmed });
    }
  };

  if (!activeStrategy) {
    return (
      <div className={styles.emptyState}>
        <h3>Nenhuma estratégia</h3>
        <p>Crie uma estratégia para começar.</p>
        <button
          className={styles.btnPrimary}
          style={{ marginTop: 16 }}
          onClick={() => {
            const s = createStrategy({ name: 'Minha Carteira', deviationTolerance: 3 });
            setActiveStrategy(s.id);
          }}
        >
          <Plus size={16} /> Criar estratégia
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Configuração da Estratégia</h2>
        <div className={styles.headerActions}>
          {strategies.length > 1 && (
            <button className={styles.btnGhost} onClick={() => setStrategyToDelete({ id: activeStrategy.id, name: activeStrategy.name })}>
              <Trash2 size={15} /> Excluir Estratégia
            </button>
          )}
          <button className={styles.btnPrimary} onClick={() => {
             const s = createStrategy({ name: 'Nova Carteira', deviationTolerance: 3 });
             setActiveStrategy(s.id);
          }}>
            <Plus size={15} /> Nova Estratégia
          </button>
        </div>
      </div>

      <div className={styles.splitView}>
        {/* Esquerda: Configurações Gerais */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Preferências</h3>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="strat-name">Nome da carteira</label>
            <input
              id="strat-name"
              className={styles.input}
              value={stratName}
              onChange={(e) => setStratName(e.target.value)}
              onBlur={handleSaveStrategy}
              placeholder="Ex: Minha Carteira Diversificada"
            />
          </div>
          <div className={styles.inputGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="strat-tolerance">Tolerância de desvio (%) <HelpTip text="Quando qualquer subclasse desviar mais que este valor, você verá alertas de rebalanceamento." /></label>
              <input
                id="strat-tolerance"
                type="number"
                step="0.5"
                min="0"
                className={styles.input}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                onBlur={handleSaveStrategy}
              />
            </div>
          </div>
        </div>

        {/* Direita: Progresso da Meta */}
        <div className={styles.targetCard}>
          <div className={`${styles.targetTotal} ${isValid ? styles.ok : styles.error}`}>
            <span className={styles.targetVal}>{totalTarget.toFixed(1)}%</span>
            <span className={styles.targetLbl}>Alocação Total</span>
          </div>
          
          <div className={styles.allocBar}>
            {classTotals.map((c, i) => {
              const pct = (c.value / totalTarget) * 100;
              return (
                <div key={c.name} className={styles.allocSeg} style={{ width: `${pct}%`, background: c.color }} title={`${c.name} - ${c.value.toFixed(1)}%`} />
              );
            })}
          </div>

          <div className={styles.allocLegend}>
            {classTotals.map(c => (
              <div key={c.name} className={styles.legendItem}>
                <div className={styles.legendColor} style={{ background: c.color }} />
                <span>{c.name} ({c.value.toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accordions de Classes e Subclasses */}
      <div className={styles.listContainer}>
        {Object.entries(groupedCategories).map(([className, cats]) => {
          const isOpen = openGroups[className] !== false; // aberto por padrão
          const classTotal = cats.reduce((s, c) => s + c.targetPercent, 0);

          return (
            <div key={className} className={styles.group}>
              <button className={styles.groupHead} onClick={() => toggleGroup(className)}>
                <ChevronDown size={16} className={`${styles.groupChevron} ${!isOpen ? styles.groupChevronClosed : ''}`} />
                <span className={styles.groupName}>{className}</span>
                <span className={styles.groupCount}>{cats.length} {cats.length === 1 ? 'ativo' : 'ativos'}</span>
                <div className={styles.groupRight}>
                  <span className={styles.groupTotal}>{classTotal.toFixed(1)}%</span>
                </div>
              </button>
              
              {isOpen && (
                <div className={styles.groupContent}>
                  {cats.map(cat => (
                    <div key={cat.id} className={styles.row}>
                      <input
                        className={styles.input}
                        style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'transparent', flex: 1, fontWeight: 600, color: 'var(--color-text-2)' }}
                        defaultValue={cat.subclassName}
                        onBlur={(e) => handleUpdateSubclassName(cat.id, e.target.value)}
                        title="Clique para renomear"
                      />
                      <div className={styles.rowInputContainer}>
                        <input
                          type="number"
                          step="0.5"
                          className={styles.rowInput}
                          defaultValue={cat.targetPercent}
                          onBlur={(e) => handleUpdateCategoryPercent(cat.id, e.target.value)}
                        />
                        <span className={styles.rowInputPercent}>%</span>
                        {savedCatId === cat.id && <CheckCircle size={14} className={styles.savedIcon} />}
                      </div>
                      <div className={styles.rowActions}>
                        <button className={styles.iconBtn} onClick={() => deleteCategory(cat.id)} title="Excluir subclasse"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))}

                  {inlineAddClass === className ? (
                    <div className={styles.addRow}>
                      <div className={styles.addFormInline}>
                        <input 
                          autoFocus
                          className={styles.input} 
                          placeholder="Ex: FIIs de Papel" 
                          value={inlineSubclass} 
                          onChange={e => setInlineSubclass(e.target.value)} 
                          onKeyDown={e => e.key === 'Enter' && handleInlineAdd()}
                        />
                        <input 
                          className={`${styles.input} ${styles.inputTarget}`} 
                          placeholder="%" 
                          type="number" 
                          value={inlineTarget} 
                          onChange={e => setInlineTarget(e.target.value)} 
                          onKeyDown={e => e.key === 'Enter' && handleInlineAdd()}
                        />
                        <button className={styles.btnAddInline} onClick={handleInlineAdd}>Salvar</button>
                        <button className={styles.btnCancelInline} onClick={() => { setInlineAddClass(null); setInlineSubclass(''); setInlineTarget(''); }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.addRow} style={{ padding: '0.4rem 1.1rem 0.6rem 2.8rem' }}>
                      <button className={styles.addBtnGhost} onClick={() => { setInlineAddClass(className); setInlineSubclass(''); setInlineTarget(''); }}>
                        <Plus size={13}/> Adicionar Subclasse
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Global Add (Nova Classe) */}
        {!inlineAddClass && (
          <div className={styles.group} style={{ padding: '1rem', background: 'var(--color-surface-2)' }}>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-text)' }}>Criar Nova Macro-Classe</h4>
            <div className={styles.addFormInline}>
              <input className={styles.input} placeholder="Nova Macro (Ex: Renda Fixa)" id="newMacro" />
              <input className={styles.input} placeholder="Subclasse" id="newSub" />
              <input className={`${styles.input} ${styles.inputTarget}`} placeholder="%" id="newTarget" type="number" />
              <button className={styles.btnAddInline} onClick={() => {
                const macro = (document.getElementById('newMacro') as HTMLInputElement).value;
                const sub = (document.getElementById('newSub') as HTMLInputElement).value;
                const tgt = parseFloat((document.getElementById('newTarget') as HTMLInputElement).value.replace(',','.'));
                if (macro && sub && tgt > 0) {
                  addCategory({ className: macro, subclassName: sub, targetPercent: tgt });
                  (document.getElementById('newMacro') as HTMLInputElement).value = '';
                  (document.getElementById('newSub') as HTMLInputElement).value = '';
                  (document.getElementById('newTarget') as HTMLInputElement).value = '';
                }
              }}>Adicionar</button>
            </div>
          </div>
        )}
      </div>

      {strategyToDelete && (
        <DeleteStrategyModal
          strategy={{ id: strategyToDelete.id, name: strategyToDelete.name }}
          onClose={() => setStrategyToDelete(null)}
          onConfirm={(id) => handleConfirmDeleteStrategy(id)}
        />
      )}
    </div>
  );
}
