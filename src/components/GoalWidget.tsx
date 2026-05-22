'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Target, Plus, Edit2, Trash2, Sparkles, TrendingUp, ArrowUp, Clock } from 'lucide-react';
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

// ── Confetti (CSS puro) ───────────────────────────────────────────────────────
function ConfettiPiece({ delay, left, color }: { delay: number; left: number; color: string }) {
  return (
    <div
      className={styles.confettiPiece}
      style={{ left: `${left}%`, animationDelay: `${delay}s`, background: color }}
    />
  );
}
const CONFETTI_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#A78BFA'];

// ── Helpers de formatação de tempo ───────────────────────────────────────────
function formatTimeFull(years: number, months: number): string {
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ano${years !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mês${months !== 1 ? 'es' : ''}`);
  if (parts.length === 0) return 'menos de 1 mês';
  return parts.join(' e ');
}

function formatTimeSaved(baseMonths: number, newMonths: number): string | null {
  const saved = baseMonths - newMonths;
  if (saved <= 0) return null;
  const y = Math.floor(saved / 12);
  const m = saved % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y}a`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(' ');
}

export default function GoalWidget({ currentValue, strategyId }: Props) {
  const { activeGoal, addGoal, updateGoal, deleteGoal, snapshots, transactions, activeAssets } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Auto-detecta métricas da carteira ─────────────────────────────────────
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

  // ── Detecta conquista ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeGoal || activeGoal.isAchieved) return;
    if (currentValue >= activeGoal.targetValue) {
      updateGoal(activeGoal.id, { isAchieved: true, achievedAt: new Date().toISOString() });
    }
  }, [activeGoal, currentValue, updateGoal]);

  const handleSaveGoal = useCallback((data: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (activeGoal) updateGoal(activeGoal.id, data);
    else addGoal(data);
  }, [activeGoal, addGoal, updateGoal]);

  const handleDelete = () => {
    if (activeGoal) { deleteGoal(activeGoal.id); setShowDeleteConfirm(false); }
  };

  // ── Mensagem motivacional ──────────────────────────────────────────────────
  const motivationalMessage = useMemo(() => {
    if (!projection || !activeGoal) return null;
    const { progressPercent, monthsToGoal, scenarios } = projection;

    if (progressPercent >= 90) {
      const remaining = activeGoal.targetValue - currentValue;
      return { icon: '⚡', text: `Falta apenas ${formatCurrency(remaining)} para alcançar sua meta!`, type: 'highlight' };
    }
    const baseMonths = scenarios.baseCase.years * 12 + scenarios.baseCase.months;
    const incMonths = scenarios.increasedContribution.years * 12 + scenarios.increasedContribution.months;
    const monthsGained = baseMonths - incMonths;
    if (monthsGained >= 3 && monthsToGoal > 24) {
      const saved = formatTimeSaved(baseMonths, incMonths);
      return {
        icon: '💡',
        text: `Aumentando seus aportes em ${formatCurrency(scenarios.increasedContribution.extraAmount)}/mês, você chegaria ${saved} antes.`,
        type: 'tip'
      };
    }
    if (monthsToGoal <= 36) {
      return { icon: '🔥', text: 'Você está no caminho certo! Mantenha o ritmo.', type: 'success' };
    }
    return { icon: '🎯', text: 'Continue investindo regularmente para alcançar sua meta!', type: 'neutral' };
  }, [projection, activeGoal, currentValue]);

  // ── Estado: sem meta definida ──────────────────────────────────────────────
  if (!activeGoal) {
    return (
      <>
        <div
          className={`card ${styles.emptyCard}`}
          onClick={() => setShowModal(true)}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setShowModal(true)}
        >
          <div className={styles.emptyInner}>
            <div className={styles.emptyIconWrap}>
              <Target size={28} className={styles.emptyIcon} />
            </div>
            <div className={styles.emptyText}>
              <h3 className={styles.emptyTitle}>Defina sua Meta Financeira</h3>
              <p className={styles.emptySubtitle}>
                Informe seu objetivo e o app calcula automaticamente quando você vai chegar lá — com base na sua carteira real.
              </p>
            </div>
            <button
              className={`btn btn-primary ${styles.emptyBtn}`}
              onClick={e => { e.stopPropagation(); setShowModal(true); }}
            >
              <Plus size={16} /> Criar minha primeira meta
            </button>
          </div>
        </div>
        {showModal && (
          <GoalModal onClose={() => setShowModal(false)} onSave={handleSaveGoal}
            strategyId={strategyId} currentValue={currentValue}
            autoMonthlyContribution={autoMonthlyContribution}
            autoAnnualReturn={autoMonthlyReturn} existingGoal={null} />
        )}
      </>
    );
  }

  // ── Estado: meta alcançada ─────────────────────────────────────────────────
  const isAchieved = activeGoal.isAchieved || currentValue >= activeGoal.targetValue;
  if (isAchieved) {
    const confettiItems = Array.from({ length: 20 }, (_, i) => ({
      delay: (i * 0.15) % 1.5, left: (i * 5.3) % 95,
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
              <span>{activeGoal.emoji}</span> {activeGoal.title} — {formatCurrency(activeGoal.targetValue)}
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
          <GoalModal onClose={() => setShowModal(false)} onSave={handleSaveGoal}
            strategyId={strategyId} currentValue={currentValue}
            autoMonthlyContribution={autoMonthlyContribution}
            autoAnnualReturn={autoMonthlyReturn} existingGoal={null} />
        )}
      </>
    );
  }

  // ── Estado principal: meta ativa ───────────────────────────────────────────
  const prog = projection!;
  const { yearsToGoal, monthsFraction, progressPercent, scenarios } = prog;
  const baseIsInfinity = prog.monthsToGoal === Infinity;
  const baseMonths = scenarios.baseCase.years * 12 + scenarios.baseCase.months;

  const incScenario = scenarios.increasedContribution;
  const retScenario = scenarios.increasedReturn;
  const incTotalMonths = incScenario.years * 12 + incScenario.months;
  const retTotalMonths = retScenario.years * 12 + retScenario.months;
  const incSaved = formatTimeSaved(baseMonths, incTotalMonths);
  const retSaved = formatTimeSaved(baseMonths, retTotalMonths);

  const effectiveContribution = activeGoal.monthlyContribution ?? autoMonthlyContribution;
  const effectiveReturnRate = (activeGoal.monthlyReturnRate ?? autoMonthlyReturn) * 12 * 100;
  const isAutoContribution = activeGoal.monthlyContribution == null;
  const isAutoReturn = activeGoal.monthlyReturnRate == null;

  return (
    <>
      <div className={`card ${styles.widget}`}>

        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
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

        {/* ── Barra de progresso ─────────────────────────────────────────── */}
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>Progresso até a meta</span>
            <span className={styles.progressPct}>{progressPercent.toFixed(1)}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
            <div className={styles.progressThumb} style={{ left: `${Math.min(progressPercent, 97)}%` }} />
          </div>
          <div className={styles.progressValues}>
            <span>{formatCurrency(currentValue)} acumulado</span>
            <span>meta: {formatCurrency(activeGoal.targetValue)}</span>
          </div>
        </div>

        {/* ── Resultado + cenários ───────────────────────────────────────── */}
        {baseIsInfinity ? (
          <div className={styles.infinityWarning}>
            {(activeGoal.monthlyReturnRate ?? autoMonthlyReturn) < 0 ? (
              <>
                <strong>⚠️ Rendimento histórico negativo detectado</strong>
                <p>
                  Seu portfólio teve desempenho negativo no período recente (possivelmente por perdas em criptoativos),
                  o que torna a meta inalcançável com os dados atuais.
                </p>
                <p>
                  Clique em <strong>✏️ Editar</strong> e ajuste o rendimento manualmente para simular
                  a taxa que você espera no futuro (ex: 10–12% a.a.).
                </p>
              </>
            ) : (
              <>⚠️ Com os parâmetros atuais a meta não é atingível. Aumente seus aportes ou o rendimento esperado.</>
            )}
          </div>
        ) : (
          <>
            {/* Resultado principal — destaque visual */}
            <div className={styles.mainResultCard}>
              <div className={styles.mainResultLeft}>
                <div className={styles.mainResultLabel}>
                  <Clock size={13} /> No ritmo atual, você chega em
                </div>
                <div className={styles.mainResultValue}>
                  {yearsToGoal > 0 && (
                    <span>{yearsToGoal}<small>ano{yearsToGoal !== 1 ? 's' : ''}</small></span>
                  )}
                  {monthsFraction > 0 && (
                    <span>{monthsFraction}<small>mês{monthsFraction !== 1 ? 'es' : ''}</small></span>
                  )}
                  {yearsToGoal === 0 && monthsFraction === 0 && (
                    <span>Menos de <small>1 mês</small></span>
                  )}
                </div>
              </div>
              <div className={styles.mainResultRight}>
                <div className={styles.mainResultStat}>
                  <span className={styles.mainResultStatLabel}>Aporte</span>
                  <span className={styles.mainResultStatValue}>{formatCurrency(effectiveContribution)}/mês</span>
                </div>
                <div className={styles.mainResultStat}>
                  <span className={styles.mainResultStatLabel}>Rendimento</span>
                  <span className={styles.mainResultStatValue}>{effectiveReturnRate.toFixed(1)}% a.a.</span>
                </div>
              </div>
            </div>

            {/* Cenários de aceleração */}
            <div className={styles.scenariosSection}>
              <div className={styles.scenariosSectionTitle}>
                ⚡ Cenários de aceleração — e se você mudasse uma coisa?
              </div>
              <div className={styles.scenariosGrid}>
                {/* Cenário 1: mais aportes */}
                <div className={styles.scenarioCard}>
                  <div className={styles.scenarioHeader}>
                    <div className={styles.scenarioIconWrap}>
                      <ArrowUp size={13} />
                    </div>
                    <span className={styles.scenarioIf}>Se aumentar aportes em</span>
                  </div>
                  <div className={styles.scenarioChange}>
                    +{formatCurrency(incScenario.extraAmount)}/mês
                  </div>
                  <div className={styles.scenarioResult}>
                    <span className={styles.scenarioResultLabel}>Chegaria em</span>
                    <span className={styles.scenarioResultTime}>
                      {formatTimeFull(incScenario.years, incScenario.monthsFraction)}
                    </span>
                    {incSaved && (
                      <span className={styles.scenarioSaved}>−{incSaved} antes</span>
                    )}
                  </div>
                </div>

                {/* Cenário 2: mais rendimento */}
                <div className={styles.scenarioCard}>
                  <div className={styles.scenarioHeader}>
                    <div className={styles.scenarioIconWrap}>
                      <TrendingUp size={13} />
                    </div>
                    <span className={styles.scenarioIf}>Se melhorar o rendimento em</span>
                  </div>
                  <div className={styles.scenarioChange}>
                    +{retScenario.extraRate}% a.a.
                  </div>
                  <div className={styles.scenarioResult}>
                    <span className={styles.scenarioResultLabel}>Chegaria em</span>
                    <span className={styles.scenarioResultTime}>
                      {formatTimeFull(retScenario.years, retScenario.monthsFraction)}
                    </span>
                    {retSaved && (
                      <span className={styles.scenarioSaved}>−{retSaved} antes</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Mensagem motivacional ─────────────────────────────────────── */}
        {motivationalMessage && (
          <div className={`${styles.motivational} ${styles[`motivational_${motivationalMessage.type}`]}`}>
            <span className={styles.motivationalIcon}>{motivationalMessage.icon}</span>
            <span>{motivationalMessage.text}</span>
          </div>
        )}

        {/* ── Rodapé: dados usados no cálculo ───────────────────────────── */}
        <div className={styles.footer}>
          <span className={styles.footerLabel}>Cálculo baseado em:</span>
          <div className={styles.footerTags}>
            <span className={styles.footerTag}>
              <Sparkles size={10} />
              {isAutoContribution ? 'Aporte auto-detectado' : 'Aporte personalizado'}: <strong>{formatCurrency(effectiveContribution)}/mês</strong>
            </span>
            <span className={styles.footerTag}>
              <TrendingUp size={10} />
              {isAutoReturn ? 'Rendimento auto-detectado' : 'Rendimento personalizado'}: <strong>{effectiveReturnRate.toFixed(1)}% a.a.</strong>
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
