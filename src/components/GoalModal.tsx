'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Target, Sparkles } from 'lucide-react';
import { FinancialGoal } from '@/types';
import { formatCurrency } from '@/lib/calculations';
import styles from './GoalModal.module.css';

// ── Metas pré-definidas ───────────────────────────────────────────────────────
const PRESET_GOALS = [
  { emoji: '🏠', title: 'Comprar uma Casa' },
  { emoji: '🚗', title: 'Comprar um Carro' },
  { emoji: '✈️', title: 'Viagem dos Sonhos' },
  { emoji: '💼', title: 'Aposentadoria' },
  { emoji: '🏦', title: 'Primeiro Milhão' },
  { emoji: '🎓', title: 'Educação' },
  { emoji: '💍', title: 'Casamento' },
  { emoji: '🏖️', title: 'Reserva de Liberdade' },
];

interface Props {
  onClose: () => void;
  onSave: (goal: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) => void;
  strategyId: string;
  currentValue: number;
  autoMonthlyContribution: number;
  autoAnnualReturn: number;
  existingGoal?: FinancialGoal | null;
}

interface FormState {
  emoji: string;
  title: string;
  targetValue: string;
  useAutoContribution: boolean;
  monthlyContribution: string;
  useAutoReturn: boolean;
  annualReturn: string;
}

function parseCurrency(value: string): number {
  return Number(value.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
}

// Formata número no padrão pt-BR sem depender de locale do ambiente
function formatInput(value: number): string {
  if (!value && value !== 0) return '';
  const fixed = value.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatted},${decPart}`;
}

// ── Cálculo de projeção inline (sem import circular) ─────────────────────────
function calcMonthsToGoal(pv: number, monthlyRate: number, pmt: number, target: number): number {
  if (pv >= target) return 0;
  if (monthlyRate <= 0 && pmt <= 0) return Infinity;
  const fv = (pv: number, r: number, n: number, pmt: number) =>
    r === 0 ? pv + pmt * n : pv * Math.pow(1 + r, n) + pmt * ((Math.pow(1 + r, n) - 1) / r);
  let lo = 0, hi = 600;
  for (let i = 0; i < 60; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (fv(pv, monthlyRate, mid, pmt) >= target) hi = mid;
    else lo = mid;
    if (hi - lo <= 1) break;
  }
  if (fv(pv, monthlyRate, hi, pmt) < target) return Infinity;
  return hi;
}

export default function GoalModal({
  onClose,
  onSave,
  strategyId,
  currentValue,
  autoMonthlyContribution,
  autoAnnualReturn,
  existingGoal,
}: Props) {
  // Se o rendimento auto-detectado for negativo (ex: crypto em perda),
  // o campo manual inicia com 10% a.a. como sugestão razoável
  const safeInitialReturn = autoAnnualReturn < 0 ? 10 : autoAnnualReturn * 100;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    emoji: existingGoal?.emoji ?? '🎯',
    title: existingGoal?.title ?? '',
    targetValue: existingGoal ? formatInput(existingGoal.targetValue) : '',
    useAutoContribution: existingGoal?.monthlyContribution == null,
    monthlyContribution: existingGoal?.monthlyContribution != null
      ? formatInput(existingGoal.monthlyContribution)
      : formatInput(autoMonthlyContribution),
    useAutoReturn: existingGoal?.monthlyReturnRate == null,
    annualReturn: existingGoal?.monthlyReturnRate != null
      ? formatInput(existingGoal.monthlyReturnRate * 12 * 100)
      : formatInput(safeInitialReturn),
  });

  // Ao alternar para manual, se taxa auto for negativa, sugere 10%
  const handleToggleReturn = () => {
    setForm(prev => ({
      ...prev,
      useAutoReturn: !prev.useAutoReturn,
      // Se estava em auto com taxa negativa e vai para manual, sugere 10%
      annualReturn: prev.useAutoReturn && autoAnnualReturn < 0
        ? formatInput(10)
        : prev.annualReturn,
    }));
  };

  const [customGoal, setCustomGoal] = useState(
    existingGoal != null && !PRESET_GOALS.find(p => p.title === existingGoal.title)
  );

  // Fecha no Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const targetValueNum = parseCurrency(form.targetValue);
  const pmt = form.useAutoContribution ? autoMonthlyContribution : parseCurrency(form.monthlyContribution);
  const annualRatePct = form.useAutoReturn ? autoAnnualReturn * 100 : parseCurrency(form.annualReturn);
  const monthlyRate = annualRatePct / 100 / 12;
  const totalMonths = calcMonthsToGoal(currentValue, monthlyRate, pmt, targetValueNum);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const progressPct = targetValueNum > 0 ? Math.min(100, (currentValue / targetValueNum) * 100) : 0;

  const canGoNext = useCallback(() => {
    if (step === 1) return form.title.trim().length > 0;
    if (step === 2) return targetValueNum > 0;
    if (step === 3) return pmt >= 0 && annualRatePct >= 0;
    return true;
  }, [step, form.title, targetValueNum, pmt, annualRatePct]);

  const handleSave = () => {
    onSave({
      strategyId,
      title: form.title.trim(),
      emoji: form.emoji,
      targetValue: targetValueNum,
      monthlyContribution: form.useAutoContribution ? undefined : pmt,
      monthlyReturnRate: form.useAutoReturn ? undefined : monthlyRate,
      isAchieved: currentValue >= targetValueNum,
      achievedAt: currentValue >= targetValueNum ? new Date().toISOString() : undefined,
    });
    onClose();
  };

  const handleCurrencyInput = (field: 'targetValue' | 'monthlyContribution') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const num = Number(raw) / 100;
    setForm(prev => ({ ...prev, [field]: formatInput(num) }));
  };

  // Rendimento: o usuário digita em % inteiro (ex: "1200" → 12,00%)
  const handlePercentInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const num = Number(raw) / 100; // 1200 → 12.00
    setForm(prev => ({ ...prev, annualReturn: formatInput(num) }));
  };

  const selectPreset = (emoji: string, title: string) => {
    setForm(prev => ({ ...prev, emoji, title }));
    setCustomGoal(false);
    setStep(2);
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Definir meta financeira">

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.stepIndicator}>
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`${styles.stepDot} ${s === step ? styles.stepDotActive : s < step ? styles.stepDotDone : ''}`}
              >
                {s < step ? <Check size={10} /> : s}
              </div>
            ))}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* ── Step 1: Escolha da Meta ───────────────────────────────────────── */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <div className={styles.stepIcon}><Target size={28} /></div>
            <h2 className={styles.stepTitle}>Qual é o seu objetivo?</h2>
            <p className={styles.stepSubtitle}>
              O app vai calcular automaticamente quando você vai chegar lá, com base na sua carteira real.
            </p>

            <div className={styles.presetGrid}>
              {PRESET_GOALS.map(({ emoji, title }) => (
                <button
                  key={title}
                  className={`${styles.presetBtn} ${form.title === title && !customGoal ? styles.presetBtnActive : ''}`}
                  onClick={() => selectPreset(emoji, title)}
                >
                  <span className={styles.presetEmoji}>{emoji}</span>
                  <span className={styles.presetLabel}>{title}</span>
                </button>
              ))}
            </div>

            <div className={styles.divider}>
              <span>ou</span>
            </div>

            {customGoal ? (
              <div className={styles.customGoalInputGroup}>
                <div className={styles.emojiPickerRow}>
                  {['🎯', '💰', '⭐', '🌟', '💎', '🚀', '🌍', '🎪'].map(e => (
                    <button
                      key={e}
                      className={`${styles.emojiBtn} ${form.emoji === e ? styles.emojiBtnActive : ''}`}
                      onClick={() => setForm(prev => ({ ...prev, emoji: e }))}
                    >{e}</button>
                  ))}
                </div>
                <input
                  className="input"
                  placeholder="Nome da sua meta personalizada"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  autoFocus
                  maxLength={60}
                />
              </div>
            ) : (
              <button
                className={styles.customGoalTrigger}
                onClick={() => { setCustomGoal(true); setForm(prev => ({ ...prev, emoji: '🎯', title: '' })); }}
              >
                ✏️ Meta personalizada...
              </button>
            )}
          </div>
        )}

        {/* ── Step 2: Valor da Meta ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <div className={styles.stepEmojiLarge}>{form.emoji}</div>
            <h2 className={styles.stepTitle}>{form.title}</h2>
            <p className={styles.stepSubtitle}>Qual o valor total que você precisa acumular?</p>

            <div className={styles.bigInputGroup}>
              <span className={styles.currencyPrefix}>R$</span>
              <input
                className={styles.bigInput}
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={form.targetValue}
                onChange={handleCurrencyInput('targetValue')}
                autoFocus
              />
            </div>

            {targetValueNum > 0 && currentValue > 0 && (
              <div className={styles.progressHint}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
                </div>
                <p className={styles.progressText}>
                  Você já tem <strong>{formatCurrency(currentValue)}</strong> — {progressPct.toFixed(1)}% da sua meta
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Dados Financeiros ─────────────────────────────────────── */}
        {step === 3 && (
          <div className={styles.stepContent}>
            <div className={styles.stepIcon}><Sparkles size={28} /></div>
            <h2 className={styles.stepTitle}>Dados financeiros</h2>
            <p className={styles.stepSubtitle}>
              Calculamos automaticamente com base na sua carteira. Você pode ajustar se quiser.
            </p>

            {/* Aportes mensais */}
            <div className={styles.dataBlock}>
              <div className={styles.dataBlockHeader}>
                <div>
                  <div className={styles.dataBlockLabel}>Aporte mensal</div>
                  <div className={styles.dataBlockHint}>Média dos últimos 6 meses da sua carteira</div>
                </div>
                <button
                  className={`${styles.toggleBtn} ${form.useAutoContribution ? styles.toggleBtnActive : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, useAutoContribution: !prev.useAutoContribution }))}
                >
                  {form.useAutoContribution ? '🔄 Auto' : '✏️ Manual'}
                </button>
              </div>
              {form.useAutoContribution ? (
                <div className={styles.autoValue}>{formatCurrency(autoMonthlyContribution)}<span>/mês</span></div>
              ) : (
                <div className={styles.inputWithPrefix}>
                  <span className={styles.inputPrefix}>R$</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    placeholder="1.500,00"
                    value={form.monthlyContribution}
                    onChange={handleCurrencyInput('monthlyContribution')}
                  />
                </div>
              )}
            </div>

            {/* Rendimento anual */}
            <div className={styles.dataBlock}>
              <div className={styles.dataBlockHeader}>
                <div>
                  <div className={styles.dataBlockLabel}>Rendimento médio anual</div>
                  <div className={styles.dataBlockHint}>Calculado pelo histórico da sua carteira</div>
                </div>
                <button
                  className={`${styles.toggleBtn} ${form.useAutoReturn ? styles.toggleBtnActive : ''}`}
                  onClick={handleToggleReturn}
                >
                  {form.useAutoReturn ? '🔄 Auto' : '✏️ Manual'}
                </button>
              </div>
              {form.useAutoReturn ? (
                <>
                  <div className={`${styles.autoValue} ${autoAnnualReturn < 0 ? styles.autoValueNegative : ''}`}>
                    {(autoAnnualReturn * 100).toFixed(1)}<span>% a.a.</span>
                  </div>
                  {autoAnnualReturn < 0 && (
                    <div className={styles.negativeReturnWarning}>
                      ⚠️ Seu portfólio teve desempenho negativo no histórico recente (provavelmente por perdas em criptoativos). Clique em <strong>Manual</strong> para simular com a taxa que você espera no futuro.
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.inputWithPrefix}>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    placeholder="12,00"
                    value={form.annualReturn}
                    onChange={handlePercentInput}
                    style={{ paddingRight: '48px' }}
                  />
                  <span className={styles.inputSuffix}>% a.a.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4: Resultado ─────────────────────────────────────────────── */}
        {step === 4 && (
          <div className={styles.stepContent}>
            <div className={styles.stepEmojiLarge}>{form.emoji}</div>
            <h2 className={styles.stepTitle}>{form.title}</h2>
            <p className={styles.stepSubtitle}>Confira sua projeção baseada nos seus dados reais</p>

            {currentValue >= targetValueNum ? (
              <div className={styles.alreadyAchieved}>
                <div className={styles.celebrationEmoji}>🎉</div>
                <h3>Você já alcançou esta meta!</h3>
                <p>Seu patrimônio de {formatCurrency(currentValue)} já superou {formatCurrency(targetValueNum)}.</p>
              </div>
            ) : totalMonths === Infinity ? (
              <div className={styles.impossibleResult}>
                <div className={styles.warningEmoji}>⚠️</div>
                <h3>Meta inacessível com os parâmetros atuais</h3>
                <p>Aumente seus aportes mensais ou o rendimento esperado para que a meta seja atingível.</p>
              </div>
            ) : (
              <>
                <div className={styles.resultCard}>
                  <div className={styles.resultLabel}>Você vai alcançar sua meta em</div>
                  <div className={styles.resultTime}>
                    {years > 0 && <span>{years}<small>ano{years !== 1 ? 's' : ''}</small></span>}
                    {months > 0 && <span>{months}<small>mês{months !== 1 ? 'es' : ''}</small></span>}
                    {years === 0 && months === 0 && <span>Menos de<small>1 mês</small></span>}
                  </div>
                </div>

                <div className={styles.resultSummary}>
                  <div className={styles.resultRow}>
                    <span>💰 Patrimônio atual</span>
                    <strong>{formatCurrency(currentValue)}</strong>
                  </div>
                  <div className={styles.resultRow}>
                    <span>📅 Aporte mensal</span>
                    <strong>{formatCurrency(pmt)}</strong>
                  </div>
                  <div className={styles.resultRow}>
                    <span>📈 Rendimento</span>
                    <strong>{annualRatePct.toFixed(1)}% a.a.</strong>
                  </div>
                  <div className={`${styles.resultRow} ${styles.resultRowTarget}`}>
                    <span>🎯 Meta</span>
                    <strong>{formatCurrency(targetValueNum)}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer — Navegação */}
        <div className={styles.footer}>
          {step > 1 ? (
            <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>
              <ChevronLeft size={16} /> Voltar
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          )}

          {step < 4 ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep(s => s + 1)}
              disabled={!canGoNext()}
            >
              Próximo <ChevronRight size={16} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleSave}>
              <Check size={16} /> Salvar meta
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
