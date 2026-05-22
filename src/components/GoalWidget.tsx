'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Target, Plus, Edit2, Trash2, Sparkles, TrendingUp, ArrowUp } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  formatCurrency,
  calculateGoalProjection,
  autoDetectMonthlyReturn,
  autoDetectMonthlyContribution,
} from '@/lib/calculations';
import { FinancialGoal } from '@/types';
import dynamic from 'next/dynamic';
import styles from './GoalWidget.module.css';

const GoalModal = dynamic(() => import('./GoalModal'), { ssr: false });

interface Props {
  currentValue: number;
  strategyId: string;
}

// ── Confetti simples (CSS puro) ───────────────────────────────────────────────
function ConfettiPiece({ delay, left, color }: { delay: number; left: number; color: string }) {
  return (
    <div
      className={styles.confettiPiece}
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        background: color,
      }}
    />
  );
}

const CONFETTI_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#A78BFA'];

function formatTimeShort(years: number, months: number): string {
  const parts = [];
  if (years > 0) parts.push(`${years}a`);
  if (months > 0) parts.push(`${months}m`);
  if (parts.length === 0) return '< 1 mês';
  return parts.join(' ');
}

export default function GoalWidget({ currentValue, strategyId }: Props) {
  const { activeGoal, addGoal, updateGoal, deleteGoal, snapshots, transactions, activeAssets } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [justAchieved, setJustAchieved] = useState(false);

  // ── Auto-detecta métricas ──────────────────────────────────────────────────
  const autoMonthlyReturn = useMemo(
    () => autoDetectMonthlyReturn(snapshots, strategyId),
    [snapshots, strategyId]
  );

  const autoMonthlyContribution = useMemo(() => {
    const assetIds = new Set(activeAssets.map(a => a.id));
    const stratTxs = transactions.filter(t => assetIds.has(t.assetId));
    return autoDetectMonthlyContribution(stratTxs, Array.from(assetIds));
  }, [transactions, activeAssets]);

  // ── Projeção ───────────────────────────────────────────────────────────────
  const projection = useMemo(() => {
    if (!activeGoal) return null;
    return calculateGoalProjection(activeGoal, currentValue, autoMonthlyContribution, autoMonthlyReturn);
  }, [activeGoal, currentValue, autoMonthlyContribution, autoMonthlyReturn]);

  // ── Detecta se meta foi alcançada agora ───────────────────────────────────
  useEffect(() => {
    if (!activeGoal || activeGoal.isAchieved) return;
    if (currentValue >= activeGoal.targetValue) {
      setJustAchieved(true);
      updateGoal(activeGoal.id, {
        isAchieved: true,
        achievedAt: new Date().toISOString(),
      });
    }
  }, [activeGoal, currentValue, updateGoal]);

  const handleSaveGoal = useCallback((data: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (activeGoal) {
      updateGoal(activeGoal.id, data);
    } else {
      addGoal(data);
    }
  }, [activeGoal, addGoal, updateGoal]);

  const handleDelete = () => {
    if (activeGoal) {
      deleteGoal(activeGoal.id);
      setShowDeleteConfirm(false);
      setJustAchieved(false);
    }
  };

  // ── Mensagem motivacional contextualizada ─────────────────────────────────
  const motivationalMessage = useMemo(() => {
    if (!projection || !activeGoal) return null;
    const { progressPercent, monthsToGoal, scenarios } = projection;

    if (progressPercent >= 90) {
      const remaining = activeGoal.targetValue - currentValue;
      return { icon: '⚡', text: `Falta apenas ${formatCurrency(remaining)} para alcançar sua meta!`, type: 'highlight' };
    }

    const inc = scenarios.increasedContribution;
    const baseMonths = scenarios.baseCase.months + scenarios.baseCase.years * 12;
    const incMonths = inc.months + inc.years * 12;
    const monthsGained = baseMonths - incMonths;

    if (monthsGained >= 3 && monthsToGoal > 24) {
      const years = Math.floor(monthsGained / 12);
      const months = monthsGained % 12;
      const timeStr = years > 0 ? `${years} ano${years > 1 ? 's' : ''}${months > 0 ? ` e ${months} mês${months > 1 ? 'es' : ''}` : ''}` : `${months} mês${months > 1 ? 'es' : ''}`;
      return {
        icon: '💡',
        text: `Aumentando seus aportes em ${formatCurrency(inc.extraAmount)}/mês, você chegaria ${timeStr} antes.`,
        type: 'tip'
      };
    }

    if (monthsToGoal <= 36) {
      return { icon: '🔥', text: 'Você está no caminho certo! Mantenha o ritmo.', type: 'success' };
    }

    const ret = scenarios.increasedReturn;
    const retMonths = ret.months + ret.years * 12;
    const retGain = baseMonths - retMonths;
    if (retGain >= 6) {
      const years = Math.floor(retGain / 12);
      const months = retGain % 12;
      const timeStr = years > 0 ? `${years} ano${years > 1 ? 's' : ''}` : `${months} meses`;
      return {
        icon: '📈',
        text: `Com +${ret.extraRate}% a.a. de rendimento, você anteciparia a meta em ${timeStr}.`,
        type: 'tip'
      };
    }

    return { icon: '🎯', text: 'Continue investindo regularmente para alcançar sua meta!', type: 'neutral' };
  }, [projection, activeGoal, currentValue]);

  // ── Estado vazio ───────────────────────────────────────────────────────────
  if (!activeGoal) {
    return (
      <>
        <div className={`card ${styles.emptyCard}`} onClick={() => setShowModal(true)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setShowModal(true)}>
          <div className={styles.emptyInner}>
            <div className={styles.emptyIconWrap}>
              <Target size={28} className={styles.emptyIcon} />
            </div>
            <div>
              <h3 className={styles.emptyTitle}>Defina sua Meta Financeira</h3>
              <p className={styles.emptySubtitle}>
                Informe seu objetivo e o app calcula automaticamente quando você vai chegar lá — com base na sua carteira real.
              </p>
            </div>
            <button className={`btn btn-primary ${styles.emptyBtn}`} onClick={e => { e.stopPropagation(); setShowModal(true); }}>
              <Plus size={16} /> Criar minha primeira meta
            </button>
          </div>
        </div>

        {showModal && (
          <GoalModal
            onClose={() => setShowModal(false)}
            onSave={handleSaveGoal}
            strategyId={strategyId}
            currentValue={currentValue}
            autoMonthlyContribution={autoMonthlyContribution}
            autoAnnualReturn={autoMonthlyReturn}
            existingGoal={null}
          />
        )}
      </>
    );
  }

  // ── Estado: Meta alcançada / Celebração ───────────────────────────────────
  const isAchieved = activeGoal.isAchieved || currentValue >= activeGoal.targetValue;
  if (isAchieved) {
    const confettiItems = Array.from({ length: 20 }, (_, i) => ({
      delay: (i * 0.15) % 1.5,
      left: (i * 5.3) % 95,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }));

    return (
      <>
        <div className={`card ${styles.achievedCard}`}>
          {confettiItems.map((c, i) => <ConfettiPiece key={i} {...c} />)}
          <div className={styles.achievedContent}>
            <div className={styles.achievedEmojis}>🎉 🏆 🎊</div>
            <h2 className={styles.achievedTitle}>Parabéns! Meta alcançada!</h2>
            <p className={styles.achievedGoal}>
              <span className={styles.achievedEmoji}>{activeGoal.emoji}</span>
              {activeGoal.title} — {formatCurrency(activeGoal.targetValue)}
            </p>
            {activeGoal.achievedAt && (
              <p className={styles.achievedDate}>
                Alcançada em {new Date(activeGoal.achievedAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
            )}
            <div className={styles.achievedActions}>
              <button className="btn btn-primary" onClick={() => { handleDelete(); setShowModal(true); }}>
                <Plus size={16} /> Definir nova meta
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleDelete}>
                <Trash2 size={14} /> Remover
              </button>
            </div>
          </div>
        </div>

        {showModal && (
          <GoalModal
            onClose={() => setShowModal(false)}
            onSave={handleSaveGoal}
            strategyId={strategyId}
            currentValue={currentValue}
            autoMonthlyContribution={autoMonthlyContribution}
            autoAnnualReturn={autoMonthlyReturn}
            existingGoal={null}
          />
        )}
      </>
    );
  }

  // ── Estado principal: Meta ativa ───────────────────────────────────────────
  const prog = projection!;
  const { yearsToGoal, monthsFraction, progressPercent, scenarios } = prog;
  const inc = scenarios.increasedContribution;
  const baseIsInfinity = prog.monthsToGoal === Infinity;

  return (
    <>
      <div className={`card ${styles.widget}`}>
        {/* Cabeçalho */}
        <div className={styles.widgetHeader}>
          <div className={styles.widgetTitleRow}>
            <span className={styles.widgetEmoji}>{activeGoal.emoji}</span>
            <div>
              <div className={styles.widgetTitle}>{activeGoal.title}</div>
              <div className={styles.widgetTarget}>{formatCurrency(activeGoal.targetValue)}</div>
            </div>
          </div>
          <div className={styles.widgetActions}>
            <button className={styles.actionBtn} onClick={() => setShowModal(true)} title="Editar meta">
              <Edit2 size={14} />
            </button>
            {!showDeleteConfirm ? (
              <button className={styles.actionBtn} onClick={() => setShowDeleteConfirm(true)} title="Remover meta">
                <Trash2 size={14} />
              </button>
            ) : (
              <div className={styles.deleteConfirm}>
                <span>Remover?</span>
                <button className={styles.deleteYes} onClick={handleDelete}>Sim</button>
                <button className={styles.deleteNo} onClick={() => setShowDeleteConfirm(false)}>Não</button>
              </div>
            )}
          </div>
        </div>

        {/* Barra de progresso */}
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>Progresso</span>
            <span className={styles.progressPct}>{progressPercent.toFixed(1)}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressBar}
              style={{ width: `${progressPercent}%` }}
            />
            <div className={styles.progressThumb} style={{ left: `${Math.min(progressPercent, 97)}%` }} />
          </div>
          <div className={styles.progressValues}>
            <span>{formatCurrency(currentValue)}</span>
            <span>{formatCurrency(activeGoal.targetValue)}</span>
          </div>
        </div>

        {/* Resultado principal */}
        {baseIsInfinity ? (
          <div className={styles.infinityWarning}>
            ⚠️ Com os parâmetros atuais, a meta não é atingível. Aumente seus aportes ou o rendimento esperado.
          </div>
        ) : (
          <div className={styles.mainResult}>
            <div className={styles.mainResultCard}>
              <div className={styles.mainResultLabel}>Falta</div>
              <div className={styles.mainResultValue}>
                {yearsToGoal > 0 && <span>{yearsToGoal}<small>ano{yearsToGoal !== 1 ? 's' : ''}</small></span>}
                {monthsFraction > 0 && <span>{monthsFraction}<small>mês{monthsFraction !== 1 ? 'es' : ''}</small></span>}
                {yearsToGoal === 0 && monthsFraction === 0 && <span>Menos de<small>1 mês</small></span>}
              </div>
            </div>

            {/* Cenários comparativos */}
            <div className={styles.scenarios}>
              <div className={styles.scenarioCard}>
                <div className={styles.scenarioIcon}><ArrowUp size={14} /></div>
                <div>
                  <div className={styles.scenarioLabel}>
                    +{formatCurrency(inc.extraAmount)}/mês
                  </div>
                  <div className={styles.scenarioValue}>
                    {formatTimeShort(inc.years, inc.monthsFraction)}
                  </div>
                </div>
              </div>

              <div className={styles.scenarioCard}>
                <div className={styles.scenarioIcon}><TrendingUp size={14} /></div>
                <div>
                  <div className={styles.scenarioLabel}>
                    +{scenarios.increasedReturn.extraRate}% a.a.
                  </div>
                  <div className={styles.scenarioValue}>
                    {formatTimeShort(scenarios.increasedReturn.years, scenarios.increasedReturn.monthsFraction)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mensagem motivacional */}
        {motivationalMessage && (
          <div className={`${styles.motivational} ${styles[`motivational_${motivationalMessage.type}`]}`}>
            <span className={styles.motivationalIcon}>{motivationalMessage.icon}</span>
            <span>{motivationalMessage.text}</span>
          </div>
        )}

        {/* Rodapé com dados usados */}
        <div className={styles.footer}>
          <div className={styles.footerItem}>
            <Sparkles size={11} />
            <span>
              {activeGoal.monthlyContribution == null ? 'Aporte auto-detectado' : 'Aporte personalizado'}:{' '}
              <strong>{formatCurrency(activeGoal.monthlyContribution ?? autoMonthlyContribution)}/mês</strong>
            </span>
          </div>
          <div className={styles.footerItem}>
            <TrendingUp size={11} />
            <span>
              {activeGoal.monthlyReturnRate == null ? 'Rendimento auto-detectado' : 'Rendimento personalizado'}:{' '}
              <strong>{((activeGoal.monthlyReturnRate ?? autoMonthlyReturn) * 12 * 100).toFixed(1)}% a.a.</strong>
            </span>
          </div>
        </div>
      </div>

      {showModal && (
        <GoalModal
          onClose={() => setShowModal(false)}
          onSave={handleSaveGoal}
          strategyId={strategyId}
          currentValue={currentValue}
          autoMonthlyContribution={autoMonthlyContribution}
          autoAnnualReturn={autoMonthlyReturn}
          existingGoal={activeGoal}
        />
      )}
    </>
  );
}
