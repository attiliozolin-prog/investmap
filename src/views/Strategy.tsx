'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { StrategyCategory } from '@/types';
import { CHART_COLORS } from '@/lib/calculations';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './Strategy.module.css';
import { Plus, Trash2, Save, AlertCircle, CheckCircle, Pencil, Check, X } from 'lucide-react';
import DeleteStrategyModal from '@/components/DeleteStrategyModal';

export default function Strategy() {
  const {
    activeStrategy,
    activeStrategyId,
    updateStrategy,
    addCategory,
    updateCategory,
    deleteCategory,
    createStrategy,
    strategies,
    setActiveStrategy,
    deleteStrategy,
  } = useApp();

  const [strategyToDelete, setStrategyToDelete] = useState<{ id: string; name: string } | null>(null);
  const [stratName, setStratName] = useState(activeStrategy?.name ?? '');
  const [stratDesc, setStratDesc] = useState(activeStrategy?.description ?? '');
  const [tolerance, setTolerance] = useState(activeStrategy?.deviationTolerance ?? 3);
  const [saved, setSaved] = useState(false);

  // Sincroniza campos locais quando a estratégia ativa muda
  useEffect(() => {
    if (activeStrategy) {
      setStratName(activeStrategy.name ?? '');
      setStratDesc(activeStrategy.description ?? '');
      setTolerance(activeStrategy.deviationTolerance ?? 3);
    }
  }, [activeStrategy?.id]);

  // Estado do formulário de nova subclasse (linha global / nova classe)
  const [newClassName, setNewClassName] = useState('');
  const [newSubclass, setNewSubclass] = useState('');
  const [newTarget, setNewTarget] = useState('');

  // Confirmação de exclusão inline
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(null);

  // Edição do nome do grupo (renomear classe inteira)
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [editingClassName, setEditingClassName] = useState('');

  // Add inline por grupo
  const [inlineAddClass, setInlineAddClass] = useState<string | null>(null);
  const [inlineSubclass, setInlineSubclass] = useState('');
  const [inlineTarget, setInlineTarget] = useState('');

  // Micro-animação ao salvar %
  const [savedCatId, setSavedCatId] = useState<string | null>(null);

  const existingClasses = useMemo(() => {
    if (!activeStrategy) return [];
    return Array.from(new Set(activeStrategy.categories.map(c => c.className))).sort();
  }, [activeStrategy?.categories]);

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

  const chartData = useMemo(() => {
    return Object.entries(groupedCategories).map(([className, cats], i) => {
      const targetVal = cats.reduce((sum, c) => sum + c.targetPercent, 0);
      return {
        name: className,
        value: targetVal,
        color: CHART_COLORS[i % CHART_COLORS.length]
      };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [groupedCategories]);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const handleSaveStrategy = () => {
    if (!activeStrategy) return;
    updateStrategy(activeStrategyId, {
      name: stratName.trim() || 'Minha Carteira',
      description: stratDesc.trim(),
      deviationTolerance: Number(tolerance),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Adiciona subclasse usando o formulário inferior (nova classe ou classe existente via chip)
  const handleAddCategory = () => {
    const target = parseFloat(newTarget.replace(',', '.'));
    if (!newSubclass.trim() || isNaN(target) || target <= 0 || target > 100) return;
    addCategory({
      className: newClassName.trim() || 'Geral',
      subclassName: newSubclass.trim(),
      targetPercent: target,
    });
    setNewClassName('');
    setNewSubclass('');
    setNewTarget('');
  };

  // Adiciona subclasse inline dentro de um grupo existente
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

  // Renomeia todas as categorias de uma classe de uma vez
  const handleRenameClass = (oldName: string) => {
    const trimmed = editingClassName.trim();
    setEditingClass(null);
    if (!trimmed || trimmed === oldName) return;
    const cats = groupedCategories[oldName] ?? [];
    cats.forEach(cat => updateCategory(cat.id, { className: trimmed }));
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

  if (!activeStrategy) {
    return (
      <div className="empty-state">
        <h3>Nenhuma estratégia</h3>
        <p>Crie uma estratégia para começar.</p>
        <button
          className="btn btn-primary"
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
    <div className={styles.wrapper}>

      {/* ── Seção 1: Informações da Carteira ── */}
      <div className={`card ${styles.section}`}>
        <h3 className={styles.secTitle}>Informações da Carteira</h3>
        <div className={styles.grid2}>
          <div className="form-group">
            <label className="label" htmlFor="strat-name">Nome da carteira</label>
            <input
              id="strat-name"
              className="input"
              value={stratName}
              onChange={(e) => setStratName(e.target.value)}
              placeholder="Ex: Minha Carteira Diversificada"
            />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="strat-tolerance">Tolerância de desvio (%)</label>
            <input
              id="strat-tolerance"
              className="input"
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
            />
            <div className={styles.hint}>Desvios acima deste valor disparam alertas de rebalanceamento.</div>
          </div>
        </div>
        <div className="form-group">
          <label className="label" htmlFor="strat-desc">Descrição (opcional)</label>
          <input
            id="strat-desc"
            className="input"
            value={stratDesc}
            onChange={(e) => setStratDesc(e.target.value)}
            placeholder="Ex: Foco em dividendos e crescimento de longo prazo"
          />
        </div>
        <div className={styles.saveRow}>
          {saved && (
            <span className={styles.savedMsg}>
              <CheckCircle size={14} /> Salvo com sucesso
            </span>
          )}
          <button id="save-strategy-btn" className="btn btn-primary" onClick={handleSaveStrategy}>
            <Save size={15} /> Salvar
          </button>
        </div>
      </div>

      {/* ── Seção 2: Subclasses e Metas ── */}
      <div className={`card ${styles.section}`}>
        <div className={styles.catHeader}>
          <h3>Subclasses e Metas de Alocação</h3>
          <div className={`${styles.totalBadge} ${isValid ? styles.totalOk : styles.totalError}`}>
            {isValid ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            Total: {totalTarget.toFixed(1)}% {isValid ? '✓' : `(faltam ${(100 - totalTarget).toFixed(1)}%)`}
          </div>
        </div>

        {/* Gráfico de pizza */}
        {categories.length > 0 && isMounted && (
          <div className={styles.chartContainer}>
            <div className={styles.chartArea}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%" cy="50%"
                    outerRadius={80} innerRadius={50}
                    dataKey="value" strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Alvo']}
                    contentStyle={{
                      borderRadius: 8,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      fontSize: '0.82rem',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.chartLegend}>
              {chartData.map(d => (
                <div key={d.name} className={styles.legendItem}>
                  <div className={styles.legendDot} style={{ background: d.color }} />
                  <span className={styles.legendName}>{d.name}</span>
                  <span className={styles.legendVal}>{d.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de categorias agrupadas por classe */}
        <div className={styles.catList}>
          {Object.entries(groupedCategories).map(([className, cats]) => {
            const groupTotal = cats.reduce((s, c) => s + c.targetPercent, 0);
            const isEditingThisClass = editingClass === className;
            return (
              <div key={className} className={styles.classGroupContainer}>

                {/* Cabeçalho do grupo — editável com clique */}
                <div className={styles.classGroupHeader}>
                  {isEditingThisClass ? (
                    <div className={styles.classNameEdit}>
                      <input
                        className={`input ${styles.classNameInput}`}
                        value={editingClassName}
                        autoFocus
                        onChange={(e) => setEditingClassName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameClass(className);
                          if (e.key === 'Escape') setEditingClass(null);
                        }}
                        onBlur={() => handleRenameClass(className)}
                      />
                      <button className={`btn btn-ghost btn-sm ${styles.iconBtn}`} onClick={() => handleRenameClass(className)} title="Confirmar">
                        <Check size={13} />
                      </button>
                      <button className={`btn btn-ghost btn-sm ${styles.iconBtn}`} onClick={() => setEditingClass(null)} title="Cancelar">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className={styles.classNameBtn}
                      title="Clique para renomear a classe"
                      onClick={() => { setEditingClass(className); setEditingClassName(className); }}
                    >
                      {className}
                      <Pencil size={11} className={styles.classEditIcon} />
                    </button>
                  )}
                  <span className={styles.classGroupTotal}>({groupTotal.toFixed(1)}%)</span>
                  <button
                    className={`btn btn-ghost btn-sm ${styles.addSubBtn}`}
                    onClick={() => {
                      setInlineAddClass(inlineAddClass === className ? null : className);
                      setInlineSubclass('');
                      setInlineTarget('');
                    }}
                    title="Adicionar subclasse neste grupo"
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>

                {/* Linhas de subclasse */}
                <div className={styles.classGroupItems}>
                  {cats.map((cat) => (
                    <div key={cat.id}>
                      {confirmDeleteCatId === cat.id ? (
                        <div className={styles.deleteConfirm}>
                          <Trash2 size={13} />
                          <span>Remover <strong>{cat.subclassName}</strong>?</span>
                          <button
                            className={styles.deleteConfirmYes}
                            onClick={() => { deleteCategory(cat.id); setConfirmDeleteCatId(null); }}
                          >
                            Sim
                          </button>
                          <button className={styles.deleteConfirmNo} onClick={() => setConfirmDeleteCatId(null)}>
                            Não
                          </button>
                        </div>
                      ) : (
                        <div className={`${styles.catRow} ${savedCatId === cat.id ? styles.catRowSaved : ''}`}>
                          <div className={styles.catNames}>
                            <input
                              key={`${cat.id}-sub`}
                              className={`input ${styles.catInput}`}
                              defaultValue={cat.subclassName}
                              onBlur={(e) => updateCategory(cat.id, { subclassName: e.target.value })}
                              placeholder="Nome da subclasse"
                            />
                          </div>
                          <div className={styles.catRight}>
                            <div className={styles.percentInput}>
                              <input
                                key={`${cat.id}-pct`}
                                className={`input ${styles.pctField}`}
                                defaultValue={cat.targetPercent}
                                onBlur={(e) => handleUpdateCategoryPercent(cat.id, e.target.value)}
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                              />
                              <span className={styles.pctSymbol}>%</span>
                            </div>
                            <button
                              id={`delete-cat-${cat.id}`}
                              className="btn btn-danger btn-sm"
                              onClick={() => setConfirmDeleteCatId(cat.id)}
                              title="Remover subclasse"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Formulário de adição inline dentro do grupo */}
                  {inlineAddClass === className && (
                    <div className={styles.inlineAddRow}>
                      <input
                        autoFocus
                        className={`input ${styles.catInput}`}
                        value={inlineSubclass}
                        onChange={(e) => setInlineSubclass(e.target.value)}
                        placeholder="Nome da subclasse..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInlineAdd();
                          if (e.key === 'Escape') setInlineAddClass(null);
                        }}
                      />
                      <div className={styles.percentInput}>
                        <input
                          className={`input ${styles.pctField}`}
                          value={inlineTarget}
                          onChange={(e) => setInlineTarget(e.target.value)}
                          placeholder="0"
                          type="number"
                          min="0"
                          max="100"
                          onKeyDown={(e) => { if (e.key === 'Enter') handleInlineAdd(); }}
                        />
                        <span className={styles.pctSymbol}>%</span>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleInlineAdd}
                        disabled={!inlineSubclass.trim() || !inlineTarget}
                        title="Confirmar"
                      >
                        <Check size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setInlineAddClass(null)} title="Cancelar">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Formulário de adição de nova classe / subclasse */}
        <div className={styles.newClassSection}>
          <p className={styles.newClassLabel}>
            <Plus size={13} />
            {existingClasses.length > 0 ? 'Adicionar em nova classe' : 'Adicionar primeira subclasse'}
          </p>

          {/* Chips das classes existentes para seleção rápida */}
          {existingClasses.length > 0 && (
            <div className={styles.classChips}>
              <span className={styles.chipsHint}>Usar classe existente:</span>
              {existingClasses.map(cls => (
                <button
                  key={cls}
                  className={`${styles.classChip} ${newClassName === cls ? styles.classChipActive : ''}`}
                  onClick={() => setNewClassName(prev => prev === cls ? '' : cls)}
                >
                  {cls}
                </button>
              ))}
            </div>
          )}

          <div className={styles.addRow}>
            <input
              id="new-classname"
              className={`input ${styles.catInput}`}
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Nome da classe (ex: Renda Variável)"
            />
            <input
              id="new-subclass"
              className={`input ${styles.catInput}`}
              value={newSubclass}
              onChange={(e) => setNewSubclass(e.target.value)}
              placeholder="Subclasse (ex: ETF)"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
            />
            <div className={styles.percentInput}>
              <input
                id="new-target"
                className={`input ${styles.pctField}`}
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="0"
                type="number"
                min="0"
                max="100"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
              />
              <span className={styles.pctSymbol}>%</span>
            </div>
            <button
              id="add-category-btn"
              className="btn btn-primary"
              onClick={handleAddCategory}
              disabled={!newSubclass.trim() || !newTarget}
            >
              <Plus size={15} /> Adicionar
            </button>
          </div>
        </div>

        {!isValid && categories.length > 0 && (
          <div className={styles.warning}>
            <AlertCircle size={14} />
            A soma dos percentuais deve ser exatamente 100%. Atual: {totalTarget.toFixed(1)}%
          </div>
        )}
      </div>

      {/* ── Seção 3: Outras Carteiras ── */}
      <div className={`card ${styles.section}`}>
        <h3>Outras Carteiras</h3>
        <p style={{ marginTop: 8 }}>Você pode criar múltiplas carteiras com estratégias diferentes.</p>
        <div style={{ marginTop: 16 }}>
          {strategies.map((s) => {
            const subclassCount = s.categories?.length ?? 0;
            return (
              <div key={s.id} className={`${styles.stratRow} ${s.id === activeStrategyId ? styles.stratActive : ''}`}>
                <div>
                  <div className={styles.stratName}>{s.name}</div>
                  <div className={styles.stratMeta}>
                    {s.description && <span className={styles.stratDesc}>{s.description} · </span>}
                    <span className={styles.stratCount}>{subclassCount} subclasse{subclassCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className={styles.stratActions}>
                  {s.id !== activeStrategyId && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setActiveStrategy(s.id)}>
                      Selecionar
                    </button>
                  )}
                  {s.id === activeStrategyId && (
                    <span className="badge badge-success">Ativa</span>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-danger)' }}
                    title="Excluir Carteira"
                    onClick={() => setStrategyToDelete({ id: s.id, name: s.name })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          <button
            id="new-strategy-btn"
            className="btn btn-ghost"
            style={{ marginTop: 12 }}
            onClick={() => {
              const s = createStrategy({ name: 'Nova Carteira', deviationTolerance: 3 });
              setActiveStrategy(s.id);
              setStratName('Nova Carteira');
              setStratDesc('');
            }}
          >
            <Plus size={15} /> Nova Carteira
          </button>
        </div>
      </div>

      {strategyToDelete && (
        <DeleteStrategyModal
          strategy={strategyToDelete}
          onClose={() => setStrategyToDelete(null)}
          onConfirm={handleConfirmDeleteStrategy}
        />
      )}
    </div>
  );
}
