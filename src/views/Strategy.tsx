'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { StrategyCategory } from '@/types';
import { CHART_COLORS } from '@/lib/calculations';
import styles from './Strategy.module.css';
import { Plus, Trash2, CheckCircle, ChevronDown, Target } from 'lucide-react';
import HelpTip from '@/components/HelpTip';
import DeleteStrategyModal from '@/components/DeleteStrategyModal';

export default function Strategy() {
  const {
    activeStrategy, activeStrategyId, updateStrategy, addCategory, updateCategory,
    deleteCategory, createStrategy, strategies, setActiveStrategy, deleteStrategy,
  } = useApp();

  const [strategyToDelete, setStrategyToDelete] = useState<{ id: string; name: string } | null>(null);
  const [stratName, setStratName] = useState(activeStrategy?.name ?? '');
  const [tolerance, setTolerance] = useState(activeStrategy?.deviationTolerance ?? 3);

  useEffect(() => {
    if (activeStrategy) {
      setStratName(activeStrategy.name ?? '');
      setTolerance(activeStrategy.deviationTolerance ?? 3);
    }
  }, [activeStrategy]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (cn: string) => setOpenGroups(p => ({ ...p, [cn]: !p[cn] }));

  const [inlineAddClass, setInlineAddClass] = useState<string | null>(null);
  const [inlineSubclass, setInlineSubclass] = useState('');
  const [inlineTarget, setInlineTarget] = useState('');
  const [savedCatId, setSavedCatId] = useState<string | null>(null);

  // Refs para add global
  const refMacro = useRef<HTMLInputElement>(null);
  const refSub   = useRef<HTMLInputElement>(null);
  const refTgt   = useRef<HTMLInputElement>(null);

  const rawCategories = activeStrategy?.categories;
  const categories = useMemo(() => rawCategories ?? [], [rawCategories]);
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

  const classTotals = useMemo(() => {
    return Object.entries(groupedCategories).map(([className, cats], i) => ({
      name: className,
      value: cats.reduce((s, c) => s + c.targetPercent, 0),
      color: CHART_COLORS[i % CHART_COLORS.length],
    })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [groupedCategories]);

  // Mapa de cor por classe para usar nos accordion headers
  const classColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.keys(groupedCategories).sort((a, b) => a.localeCompare(b)).forEach((cn, i) => {
      map[cn] = CHART_COLORS[i % CHART_COLORS.length];
    });
    return map;
  }, [groupedCategories]);

  const handleSaveStrategy = () => {
    if (!activeStrategy) return;
    updateStrategy(activeStrategyId, {
      name: stratName.trim() || 'Minha Carteira',
      deviationTolerance: Number(tolerance),
    });
  };

  const handleInlineAdd = () => {
    if (!inlineAddClass) return;
    const target = parseFloat(inlineTarget.replace(',', '.'));
    if (!inlineSubclass.trim() || isNaN(target) || target <= 0 || target > 100) return;
    addCategory({ className: inlineAddClass, subclassName: inlineSubclass.trim(), targetPercent: target });
    setInlineSubclass(''); setInlineTarget(''); setInlineAddClass(null);
  };

  const handleGlobalAdd = () => {
    const macro = refMacro.current?.value.trim() ?? '';
    const sub   = refSub.current?.value.trim()   ?? '';
    const tgt   = parseFloat((refTgt.current?.value ?? '').replace(',','.'));
    if (!macro || !sub || isNaN(tgt) || tgt <= 0) return;
    addCategory({ className: macro, subclassName: sub, targetPercent: tgt });
    if (refMacro.current) refMacro.current.value = '';
    if (refSub.current)   refSub.current.value   = '';
    if (refTgt.current)   refTgt.current.value   = '';
  };

  const handleConfirmDeleteStrategy = (id: string) => {
    deleteStrategy(id);
    setStrategyToDelete(null);
    const remaining = strategies.filter(s => s.id !== id);
    if (remaining.length > 0) setActiveStrategy(remaining[0].id);
  };

  const handleUpdatePercent = (id: string, val: string) => {
    const num = parseFloat(val.replace(',', '.'));
    if (!isNaN(num) && num >= 0 && num <= 100) {
      updateCategory(id, { targetPercent: num });
      setSavedCatId(id);
      setTimeout(() => setSavedCatId(null), 1200);
    }
  };

  const handleUpdateSubclassName = (id: string, val: string) => {
    const trimmed = val.trim();
    if (trimmed) updateCategory(id, { subclassName: trimmed });
  };

  // ── Gauge SVG ──
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(totalTarget, 100);
  const dashOffset = circumference - (clampedPct / 100) * circumference;
  const gaugeColor = isValid ? '#10B981' : totalTarget > 100 ? '#EF4444' : 'var(--color-primary)';

  if (!activeStrategy) {
    return (
      <div className={styles.emptyState}>
        <h3>Nenhuma estratégia</h3>
        <p>Crie uma estratégia de alocação para começar.</p>
        <button
          className={styles.btnPrimary}
          style={{ marginTop: 16 }}
          onClick={() => {
            const s = createStrategy({ name: 'Minha Carteira', deviationTolerance: 3 });
            setActiveStrategy(s.id);
          }}
        >
          <Plus size={16}/> Criar estratégia
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          <Target size={20} color="var(--color-primary)"/>
          Estratégia de Alocação
          <span className={styles.titleMeta}>· {activeStrategy.name}</span>
        </h2>
        <div className={styles.headerActions}>
          {strategies.length > 1 && (
            <button className={styles.btnGhost} onClick={() => setStrategyToDelete({ id: activeStrategy.id, name: activeStrategy.name })}>
              <Trash2 size={14}/> Excluir
            </button>
          )}
          <button className={styles.btnPrimary} onClick={() => {
            const s = createStrategy({ name: 'Nova Carteira', deviationTolerance: 3 });
            setActiveStrategy(s.id);
          }}>
            <Plus size={14}/> Nova Estratégia
          </button>
        </div>
      </div>

      {/* Split View */}
      <div className={styles.splitView}>
        {/* Config */}
        <div className={styles.card}>
          <span className={styles.cardTitle}>Preferências</span>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="strat-name">Nome da carteira</label>
            <input
              id="strat-name"
              className={styles.input}
              value={stratName}
              onChange={e => setStratName(e.target.value)}
              onBlur={handleSaveStrategy}
              placeholder="Ex: Carteira Diversificada"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="strat-tolerance">
              Tolerância de desvio (%)
              <HelpTip text="Quando qualquer subclasse desviar mais que este valor, você verá alertas de rebalanceamento. Para alvos pequenos, o app usa automaticamente a regra 5/25: alerta também quando o desvio passa de 25% do próprio alvo (ex.: alvo de 4% alerta a partir de 1 ponto)."/>
            </label>
            <input
              id="strat-tolerance"
              type="number" step="0.5" min="0"
              className={styles.input}
              style={{ maxWidth: 140 }}
              value={tolerance}
              onChange={e => setTolerance(Number(e.target.value))}
              onBlur={handleSaveStrategy}
            />
          </div>
        </div>

        {/* Gauge + Bar */}
        <div className={styles.targetCard}>
          {/* Gauge Ring + Info */}
          <div className={styles.gaugeWrap}>
            <svg width={130} height={130} viewBox="0 0 130 130" className={styles.gaugeSvg}>
              {/* Track */}
              <circle
                cx={65} cy={65} r={radius}
                fill="none"
                stroke="var(--color-surface-2)"
                strokeWidth={10}
              />
              {/* Progress */}
              <circle
                cx={65} cy={65} r={radius}
                fill="none"
                stroke={gaugeColor}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 65 65)"
                style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }}
              />
              {/* Glow */}
              <circle
                cx={65} cy={65} r={radius}
                fill="none"
                stroke={gaugeColor}
                strokeWidth={2}
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 65 65)"
                opacity={0.25}
                style={{ filter: 'blur(4px)', transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
              />
            </svg>

            <div className={styles.gaugeInfo}>
              <span className={styles.gaugeLabel}>Alocação Total</span>
              <span className={`${styles.gaugePct} ${isValid ? styles.gaugePctOk : styles.gaugePctErr}`}>
                {totalTarget.toFixed(1)}%
              </span>
              <span className={`${styles.gaugeStatus} ${isValid ? styles.gaugeOk : styles.gaugeErr}`}>
                {isValid
                  ? <><CheckCircle size={12}/> Balanceada</>
                  : totalTarget > 100
                  ? '↑ Excesso'
                  : '↓ Incompleta'}
              </span>
            </div>
          </div>

          {/* Stacked bar */}
          {classTotals.length > 0 && (
            <>
              <div className={styles.allocBar}>
                {classTotals.map(c => {
                  const pct = totalTarget > 0 ? (c.value / totalTarget) * 100 : 0;
                  return (
                    <div
                      key={c.name}
                      className={styles.allocSeg}
                      style={{ width: `${pct}%`, background: c.color }}
                      title={`${c.name} — ${c.value.toFixed(1)}%`}
                    />
                  );
                })}
              </div>
              <div className={styles.allocLegend}>
                {classTotals.map(c => (
                  <div key={c.name} className={styles.legendItem}>
                    <div className={styles.legendColor} style={{ background: c.color }}/>
                    {c.name}
                    <span className={styles.legendVal}>{c.value.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Accordions */}
      <div className={styles.listContainer}>
        {Object.entries(groupedCategories).map(([className, cats]) => {
          const isOpen = openGroups[className] !== false;
          const classTotal = cats.reduce((s, c) => s + c.targetPercent, 0);
          const color = classColorMap[className];

          return (
            <div key={className} className={styles.group}>
              <button className={styles.groupHead} onClick={() => toggleGroup(className)}>
                <div className={styles.groupColorDot} style={{ background: color }}/>
                <ChevronDown size={15} className={`${styles.groupChevron} ${!isOpen ? styles.groupChevronClosed : ''}`}/>
                <span className={styles.groupName}>{className}</span>
                <span className={styles.groupCount}>{cats.length}</span>
                <div className={styles.groupRight}>
                  <div className={styles.groupMiniBar}>
                    <div
                      className={styles.groupMiniFill}
                      style={{
                        width: `${Math.min(classTotal, 100)}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <span className={styles.groupPct}>{classTotal.toFixed(1)}%</span>
                </div>
              </button>

              {isOpen && (
                <div className={styles.groupContent}>
                  {cats.map(cat => (
                    <div key={cat.id} className={styles.row}>
                      <input
                        className={styles.rowName}
                        defaultValue={cat.subclassName}
                        onBlur={e => handleUpdateSubclassName(cat.id, e.target.value)}
                        title="Clique para renomear"
                      />
                      <div className={styles.rowInputContainer}>
                        <input
                          type="number" step="0.5"
                          className={styles.rowInput}
                          defaultValue={cat.targetPercent}
                          onBlur={e => handleUpdatePercent(cat.id, e.target.value)}
                        />
                        <span className={styles.rowInputPercent}>%</span>
                        {savedCatId === cat.id && <CheckCircle size={14} className={styles.savedIcon}/>}
                      </div>
                      <div className={styles.rowActions}>
                        <button className={styles.iconBtn} onClick={() => deleteCategory(cat.id)} title="Excluir">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                  ))}

                  {inlineAddClass === className ? (
                    <div className={styles.addRow}>
                      <div className={styles.addFormInline}>
                        <input
                          autoFocus
                          className={styles.input}
                          placeholder="Nome da subclasse"
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
                        <button className={styles.btnCancelInline} onClick={() => { setInlineAddClass(null); setInlineSubclass(''); setInlineTarget(''); }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.addRow} style={{ paddingTop: '0.4rem', paddingBottom: '0.55rem' }}>
                      <button className={styles.addBtnGhost} onClick={() => { setInlineAddClass(className); setInlineSubclass(''); setInlineTarget(''); }}>
                        <Plus size={12}/> Adicionar Subclasse
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Nova Macro-Classe */}
        {!inlineAddClass && (
          <div className={styles.newMacroRow}>
            <div className={styles.newMacroLabel}><Plus size={11}/> Nova Macro-Classe</div>
            <div className={styles.addFormInline}>
              <input ref={refMacro} className={styles.input} placeholder="Classe (ex: Renda Fixa)" style={{ flex: '1.4' }}/>
              <input ref={refSub}   className={styles.input} placeholder="Subclasse (ex: CDB)" style={{ flex: 1 }}/>
              <input ref={refTgt}   className={`${styles.input} ${styles.inputTarget}`} placeholder="%" type="number"/>
              <button className={styles.btnAddInline} onClick={handleGlobalAdd}>Adicionar</button>
            </div>
          </div>
        )}
      </div>

      {strategyToDelete && (
        <DeleteStrategyModal
          strategy={{ id: strategyToDelete.id, name: strategyToDelete.name }}
          onClose={() => setStrategyToDelete(null)}
          onConfirm={id => handleConfirmDeleteStrategy(id)}
        />
      )}
    </div>
  );
}
