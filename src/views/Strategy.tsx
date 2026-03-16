'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { StrategyCategory } from '@/types';
import { generateId } from '@/lib/calculations';
import styles from './Strategy.module.css';
import { Plus, Trash2, Save, AlertCircle, CheckCircle } from 'lucide-react';

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
  } = useApp();

  const [stratName, setStratName] = useState(activeStrategy?.name ?? '');
  const [stratDesc, setStratDesc] = useState(activeStrategy?.description ?? '');
  const [tolerance, setTolerance] = useState(activeStrategy?.deviationTolerance ?? 3);
  const [saved, setSaved] = useState(false);

  const [newClassName, setNewClassName] = useState('');
  const [newSubclass, setNewSubclass] = useState('');
  const [newTarget, setNewTarget] = useState('');

  const categories = activeStrategy?.categories ?? [];
  const totalTarget = categories.reduce((s, c) => s + c.targetPercent, 0);
  const isValid = Math.abs(totalTarget - 100) < 0.01;

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

  const handleAddCategory = () => {
    const target = parseFloat(newTarget.replace(',', '.'));
    if (!newSubclass.trim() || isNaN(target) || target <= 0) return;
    addCategory({
      className: newClassName.trim() || 'Geral',
      subclassName: newSubclass.trim(),
      targetPercent: target,
    });
    setNewClassName('');
    setNewSubclass('');
    setNewTarget('');
  };

  const handleUpdateCategoryPercent = (id: string, val: string) => {
    const num = parseFloat(val.replace(',', '.'));
    if (!isNaN(num)) updateCategory(id, { targetPercent: num });
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
      {/* Strategy Info */}
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

      {/* Categories */}
      <div className={`card ${styles.section}`}>
        <div className={styles.catHeader}>
          <h3>Subclasses e Metas de Alocação</h3>
          <div className={`${styles.totalBadge} ${isValid ? styles.totalOk : styles.totalError}`}>
            {isValid ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            Total: {totalTarget.toFixed(1)}% {isValid ? '✓' : `(faltam ${(100 - totalTarget).toFixed(1)}%)`}
          </div>
        </div>

        {/* Category list */}
        <div className={styles.catList}>
          {categories.map((cat) => (
            <div key={cat.id} className={styles.catRow}>
              <div className={styles.catNames}>
                <input
                  className={`input ${styles.catInput}`}
                  defaultValue={cat.className}
                  onBlur={(e) => updateCategory(cat.id, { className: e.target.value })}
                  placeholder="Classe"
                />
                <input
                  className={`input ${styles.catInput}`}
                  defaultValue={cat.subclassName}
                  onBlur={(e) => updateCategory(cat.id, { subclassName: e.target.value })}
                  placeholder="Subclasse"
                />
              </div>
              <div className={styles.catRight}>
                <div className={styles.percentInput}>
                  <input
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
                  onClick={() => deleteCategory(cat.id)}
                  title="Remover subclasse"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add new category */}
        <div className={styles.addRow}>
          <input
            id="new-classname"
            className={`input ${styles.catInput}`}
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="Classe (ex: Renda Variável)"
          />
          <input
            id="new-subclass"
            className={`input ${styles.catInput}`}
            value={newSubclass}
            onChange={(e) => setNewSubclass(e.target.value)}
            placeholder="Subclasse (ex: ETF)"
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

        {!isValid && categories.length > 0 && (
          <div className={styles.warning}>
            <AlertCircle size={14} />
            A soma dos percentuais deve ser exatamente 100%. Atual: {totalTarget.toFixed(1)}%
          </div>
        )}
      </div>

      {/* Multiple strategies */}
      <div className={`card ${styles.section}`}>
        <h3>Outras Carteiras</h3>
        <p style={{ marginTop: 8 }}>Você pode criar múltiplas carteiras com estratégias diferentes.</p>
        <div style={{ marginTop: 16 }}>
          {strategies.map((s) => (
            <div key={s.id} className={`${styles.stratRow} ${s.id === activeStrategyId ? styles.stratActive : ''}`}>
              <div>
                <div className={styles.stratName}>{s.name}</div>
                {s.description && <div className={styles.stratDesc}>{s.description}</div>}
              </div>
              <div className={styles.stratActions}>
                {s.id !== activeStrategyId && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setActiveStrategy(s.id)}
                  >
                    Selecionar
                  </button>
                )}
                {s.id === activeStrategyId && (
                  <span className="badge badge-success">Ativa</span>
                )}
              </div>
            </div>
          ))}
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
    </div>
  );
}
