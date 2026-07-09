'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { StrategyCategory } from '@/types';
import {
  TrendingUp, Wallet, Receipt, Sparkles,
  PlusCircle, ArrowRight, Check, ChevronLeft, ChevronRight,
  Shield, Scale, Rocket, PartyPopper, Target, PieChart,
  LineChart, Landmark, Umbrella, Coins, FileSpreadsheet
} from 'lucide-react';
import styles from './OnboardingFlow.module.css';

// ─── Perfis de investimento ───────────────────────────────────────────────────

const PROFILES = [
  {
    id: 'conservador',
    emoji: '🛡️',
    title: 'Conservador',
    badge: null,
    desc: 'Foco em segurança e preservação de capital com retornos previsíveis.',
    Icon: Shield,
    color: '#10B981',
    categories: [
      { className: 'Renda Fixa', subclassName: 'Tesouro Direto', targetPercent: 80 },
      { className: 'Renda Variável', subclassName: 'Ações - Dividendos', targetPercent: 10 },
      { className: 'Renda Variável', subclassName: 'FIIs', targetPercent: 10 },
    ] as Omit<StrategyCategory, 'id' | 'strategyId'>[]
  },
  {
    id: 'moderado',
    emoji: '⚖️',
    title: 'Moderado',
    badge: 'Mais popular',
    desc: 'Equilíbrio ideal entre crescimento patrimonial e proteção contra riscos.',
    Icon: Scale,
    color: '#8B5CF6',
    categories: [
      { className: 'Renda Fixa', subclassName: 'CDBs e Tesouro', targetPercent: 50 },
      { className: 'Renda Variável', subclassName: 'Ações - Brasil', targetPercent: 20 },
      { className: 'Renda Variável', subclassName: 'Ações - Exterior', targetPercent: 10 },
      { className: 'Renda Variável', subclassName: 'FIIs', targetPercent: 20 },
    ] as Omit<StrategyCategory, 'id' | 'strategyId'>[]
  },
  {
    id: 'arrojado',
    emoji: '🚀',
    title: 'Arrojado',
    badge: null,
    desc: 'Foco em maximização a longo prazo, tolerando maior volatilidade.',
    Icon: Rocket,
    color: '#F59E0B',
    categories: [
      { className: 'Renda Fixa', subclassName: 'Reserva de Oportunidade', targetPercent: 20 },
      { className: 'Renda Variável', subclassName: 'Ações - Valor', targetPercent: 30 },
      { className: 'Renda Variável', subclassName: 'Exterior', targetPercent: 30 },
      { className: 'Renda Variável', subclassName: 'FIIs', targetPercent: 20 },
    ] as Omit<StrategyCategory, 'id' | 'strategyId'>[]
  }
];

const SEG_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'];

// ─── Tour de funcionalidades (carrossel) ─────────────────────────────────────

interface FeatureSlide {
  id: string;
  Icon: React.ElementType;
  color: string;
  tag: string;
  title: string;
  desc: string;
  bullets: string[];
  preview: React.ReactNode;
}

/** Mini-preview: carteira com ativos em tempo real */
function PreviewPortfolio() {
  const rows = [
    { t: 'PETR4', v: '+2,4%', up: true, w: '72%' },
    { t: 'IVVB11', v: '+1,1%', up: true, w: '56%' },
    { t: 'MXRF11', v: '-0,6%', up: false, w: '38%' },
  ];
  return (
    <div className={styles.previewBox}>
      {rows.map(r => (
        <div key={r.t} className={styles.pvRow}>
          <span className={styles.pvTicker}>{r.t}</span>
          <div className={styles.pvBarTrack}>
            <div className={styles.pvBarFill} style={{ width: r.w }} />
          </div>
          <span className={r.up ? styles.pvUp : styles.pvDown}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

/** Mini-preview: rebalanceamento (atual vs alvo) */
function PreviewRebalance() {
  const cats = [
    { n: 'Renda Fixa', cur: 42, tgt: 50, c: '#8B5CF6' },
    { n: 'Ações', cur: 34, tgt: 30, c: '#3B82F6' },
    { n: 'FIIs', cur: 24, tgt: 20, c: '#10B981' },
  ];
  return (
    <div className={styles.previewBox}>
      {cats.map(c => (
        <div key={c.n} className={styles.pvRow}>
          <span className={styles.pvLabel}>{c.n}</span>
          <div className={styles.pvBarTrack}>
            <div className={styles.pvBarFill} style={{ width: `${c.cur}%`, background: c.c }} />
            <div className={styles.pvTargetMark} style={{ left: `${c.tgt}%` }} />
          </div>
          <span className={styles.pvDelta}>{c.cur < c.tgt ? `aportar +${c.tgt - c.cur}%` : 'ok'}</span>
        </div>
      ))}
    </div>
  );
}

/** Mini-preview: evolução do patrimônio */
function PreviewFinances() {
  const bars = [28, 36, 33, 45, 52, 64, 78];
  return (
    <div className={`${styles.previewBox} ${styles.pvChart}`}>
      {bars.map((h, i) => (
        <div key={i} className={styles.pvChartBar} style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}

/** Mini-preview: meta com progresso */
function PreviewGoal() {
  return (
    <div className={styles.previewBox}>
      <div className={styles.pvGoalHeader}>
        <span>🏖️ Independência financeira</span>
        <strong>62%</strong>
      </div>
      <div className={styles.pvBarTrack} style={{ height: 8 }}>
        <div className={`${styles.pvBarFill} ${styles.pvGoalFill}`} style={{ width: '62%' }} />
      </div>
      <div className={styles.pvGoalFooter}>R$ 620 mil de R$ 1 milhão · projeção: 6,2 anos</div>
    </div>
  );
}

/** Mini-preview: DARF */
function PreviewTaxes() {
  return (
    <div className={styles.previewBox}>
      <div className={styles.pvDarfRow}>
        <span className={styles.pvDarfBadgeOk}>Isento</span>
        <span className={styles.pvLabel}>Vendas de ações no mês: R$ 14.300 / R$ 20.000</span>
      </div>
      <div className={styles.pvDarfRow}>
        <span className={styles.pvDarfBadgeDue}>DARF R$ 187,50</span>
        <span className={styles.pvLabel}>FIIs · vence dia 31 — código 6015</span>
      </div>
    </div>
  );
}

/** Mini-preview: insight de IA */
function PreviewAi() {
  return (
    <div className={styles.previewBox}>
      <div className={styles.pvAiCard}>
        <Sparkles size={14} />
        <p>
          Sua exposição ao exterior está 8% abaixo do alvo. Considere direcionar
          os próximos aportes para <strong>IVVB11</strong> antes de novas compras em FIIs.
        </p>
      </div>
    </div>
  );
}

const FEATURES: FeatureSlide[] = [
  {
    id: 'portfolio',
    Icon: LineChart,
    color: '#8B5CF6',
    tag: 'Carteira',
    title: 'Todos os seus ativos, em tempo real',
    desc: 'Ações, FIIs, ETFs, renda fixa e exterior em um só lugar, com cotações atualizadas automaticamente.',
    bullets: ['Cotações e variação em tempo real', 'Histórico completo de cada ativo', 'Rentabilidade por ativo e por classe'],
    preview: <PreviewPortfolio />
  },
  {
    id: 'rebalance',
    Icon: PieChart,
    color: '#3B82F6',
    tag: 'Estratégia',
    title: 'Rebalanceamento sem planilha',
    desc: 'Defina sua alocação-alvo e o InvestMap calcula exatamente quanto aportar em cada categoria.',
    bullets: ['Alocação atual vs. alvo, sempre visível', 'Sugestão de aporte por categoria', 'Estratégia ajustável a qualquer momento'],
    preview: <PreviewRebalance />
  },
  {
    id: 'finances',
    Icon: Wallet,
    color: '#10B981',
    tag: 'Finanças',
    title: 'Suas finanças pessoais conectadas',
    desc: 'Registre aportes e retiradas e acompanhe a evolução do patrimônio mês a mês.',
    bullets: ['Evolução patrimonial em gráficos', 'Aportes e retiradas organizados', 'Visão consolidada de tudo que você tem'],
    preview: <PreviewFinances />
  },
  {
    id: 'goals',
    Icon: Target,
    color: '#EC4899',
    tag: 'Metas',
    title: 'Metas com projeção de chegada',
    desc: 'Defina objetivos financeiros e veja em quanto tempo você chega lá no seu ritmo atual de aportes.',
    bullets: ['Progresso visual de cada meta', 'Projeção de prazo com juros compostos', 'Simule aportes maiores e veja o impacto'],
    preview: <PreviewGoal />
  },
  {
    id: 'taxes',
    Icon: Receipt,
    color: '#F59E0B',
    tag: 'Impostos',
    title: 'Imposto de renda no piloto automático',
    desc: 'O app monitora suas vendas, controla a isenção de R$ 20 mil em ações e calcula o DARF por você.',
    bullets: ['Cálculo automático do DARF mensal', 'Controle da isenção de R$ 20 mil', 'Compensação de prejuízos acumulados'],
    preview: <PreviewTaxes />
  },
  {
    id: 'ai',
    Icon: Sparkles,
    color: '#22D3EE',
    tag: 'Inteligência Artificial',
    title: 'Um analista de IA na sua carteira',
    desc: 'Receba análises personalizadas sobre concentração, diversificação e oportunidades de melhoria.',
    bullets: ['Insights sob medida para a sua carteira', 'Alertas de concentração e desvios', 'Linguagem simples, sem jargão'],
    preview: <PreviewAi />
  },
];

// ─── Objetivos financeiros ────────────────────────────────────────────────────

const OBJECTIVES = [
  { id: 'aposentadoria', Icon: Umbrella, emoji: '🏖️', title: 'Aposentadoria', desc: 'Construir liberdade para o futuro' },
  { id: 'renda-passiva', Icon: Coins, emoji: '💸', title: 'Renda passiva', desc: 'Viver de dividendos e rendimentos' },
  { id: 'multiplicar', Icon: TrendingUp, emoji: '📈', title: 'Multiplicar patrimônio', desc: 'Crescer o capital no longo prazo' },
  { id: 'seguranca', Icon: Landmark, emoji: '🧱', title: 'Segurança financeira', desc: 'Reserva sólida e tranquilidade' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface OnboardingFlowProps {
  onFinish?: (action: 'add-asset' | 'dashboard') => void;
}

// ─── Componente de barra de progresso ─────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className={styles.progressBar}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`${styles.progressSegment} ${i < current ? styles.progressSegmentActive : ''}`}
        />
      ))}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function OnboardingFlow({ onFinish }: OnboardingFlowProps) {
  const { completeOnboarding } = useApp();
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [featureIndex, setFeatureIndex] = useState(0);
  const [selectedObjective, setSelectedObjective] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);

  const TOTAL_STEPS = 5;

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'Investidor';

  const selectedProfileData = PROFILES.find(p => p.id === selectedProfile);
  const selectedObjectiveData = OBJECTIVES.find(o => o.id === selectedObjective);

  const feature = FEATURES[featureIndex];
  const isLastFeature = featureIndex === FEATURES.length - 1;

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleSelectProfile = (id: string) => {
    setSelectedProfile(id);
    setHintDismissed(true);
  };

  const handleComplete = (action: 'add-asset' | 'dashboard') => {
    const isTestMode =
      typeof window !== 'undefined' &&
      localStorage.getItem('investmap_test_onboarding') === '1';

    if (!isTestMode) {
      const profile = PROFILES.find(p => p.id === selectedProfile) ?? PROFILES[1];
      completeOnboarding(profile.categories);
      if (selectedObjective && typeof window !== 'undefined') {
        localStorage.setItem('investmap_objective', selectedObjective);
      }
    } else {
      localStorage.removeItem('investmap_test_onboarding');
    }

    onFinish?.(action);
  };

  const handleImportB3 = () => {
    const isTestMode =
      typeof window !== 'undefined' &&
      localStorage.getItem('investmap_test_onboarding') === '1';

    if (!isTestMode) {
      const profile = PROFILES.find(p => p.id === selectedProfile) ?? PROFILES[1];
      completeOnboarding(profile.categories);
      if (selectedObjective && typeof window !== 'undefined') {
        localStorage.setItem('investmap_objective', selectedObjective);
      }
    } else {
      localStorage.removeItem('investmap_test_onboarding');
    }

    router.push('/perfil');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>

        {/* Barra de progresso */}
        <ProgressBar current={step} total={TOTAL_STEPS} />

        {/* ── Passo 1: Boas-vindas ─────────────────────────────────────── */}
        {step === 1 && (
          <div className={styles.stepContent} key="step-1">
            <div className={styles.welcomeIconWrapper}>
              <span className={styles.welcomeEmoji}>📈</span>
            </div>

            <div className={styles.badge}>Leva menos de 2 minutos ⚡</div>

            <h2 className={styles.title}>
              Olá, {firstName}! Bem-vindo ao InvestMap
            </h2>
            <p className={styles.desc}>
              Carteira, rebalanceamento, finanças, metas, impostos e análise com IA —
              tudo em um só lugar. Vamos conhecer o app e configurar seu perfil
              para que ele trabalhe por você desde o primeiro dia.{' '}
              <span className={styles.mutável}>Já investe? Você pode importar seu extrato da B3 em vez de cadastrar tudo manualmente.</span>
            </p>

            <div className={styles.pillRow}>
              <span className={styles.pill}><LineChart size={13} /> Carteira</span>
              <span className={styles.pill}><PieChart size={13} /> Estratégia</span>
              <span className={styles.pill}><Wallet size={13} /> Finanças</span>
              <span className={styles.pill}><Target size={13} /> Metas</span>
              <span className={styles.pill}><Receipt size={13} /> Impostos</span>
              <span className={styles.pill}><Sparkles size={13} /> IA</span>
            </div>

            <button className={styles.primaryButton} onClick={handleNext}>
              Conhecer o InvestMap <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ── Passo 2: Tour interativo (carrossel) ─────────────────────── */}
        {step === 2 && (
          <div className={styles.stepContent} key="step-2">
            <div className={styles.tourSlide} key={feature.id}>
              <div className={styles.tourHeader}>
                <div className={styles.tourIcon} style={{ color: feature.color, background: `${feature.color}1F` }}>
                  <feature.Icon size={24} />
                </div>
                <span className={styles.tourTag} style={{ color: feature.color, borderColor: `${feature.color}44` }}>
                  {feature.tag}
                </span>
                <span className={styles.tourCounter}>{featureIndex + 1} / {FEATURES.length}</span>
              </div>

              <h2 className={styles.tourTitle}>{feature.title}</h2>
              <p className={styles.tourDesc}>{feature.desc}</p>

              {feature.preview}

              <ul className={styles.tourBullets}>
                {feature.bullets.map((b, i) => (
                  <li key={i} style={{ animationDelay: `${i * 70}ms` }}>
                    <Check size={14} style={{ color: feature.color }} /> {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Dots de navegação */}
            <div className={styles.tourDots}>
              {FEATURES.map((f, i) => (
                <button
                  key={f.id}
                  className={`${styles.tourDot} ${i === featureIndex ? styles.tourDotActive : ''}`}
                  style={i === featureIndex ? { background: feature.color } : {}}
                  onClick={() => setFeatureIndex(i)}
                  aria-label={f.tag}
                />
              ))}
            </div>

            <div className={styles.actions}>
              <button
                className={styles.ghostButton}
                onClick={() => featureIndex === 0 ? handlePrev() : setFeatureIndex(i => i - 1)}
              >
                <ChevronLeft size={18} /> Voltar
              </button>
              <button
                className={styles.primaryButton}
                onClick={() => isLastFeature ? handleNext() : setFeatureIndex(i => i + 1)}
              >
                {isLastFeature ? 'Continuar' : 'Próximo recurso'}
                {isLastFeature ? <ArrowRight size={18} /> : <ChevronRight size={18} />}
              </button>
            </div>

            {!isLastFeature && (
              <button className={styles.skipButton} onClick={handleNext}>
                Pular tour
              </button>
            )}
          </div>
        )}

        {/* ── Passo 3: Objetivo financeiro ─────────────────────────────── */}
        {step === 3 && (
          <div className={styles.stepContent} key="step-3">
            <h2 className={styles.title}>O que te traz ao InvestMap?</h2>
            <p className={styles.desc}>
              Seu objetivo principal nos ajuda a destacar o que importa para você.{' '}
              <span className={styles.mutável}>Você pode criar metas detalhadas depois.</span>
            </p>

            <div className={styles.objectivesGrid}>
              {OBJECTIVES.map(o => {
                const isSelected = selectedObjective === o.id;
                return (
                  <button
                    key={o.id}
                    className={`${styles.objectiveCard} ${isSelected ? styles.objectiveSelected : ''}`}
                    onClick={() => setSelectedObjective(o.id)}
                  >
                    <span className={styles.objectiveEmoji}>{o.emoji}</span>
                    <h3>{o.title}</h3>
                    <p>{o.desc}</p>
                    {isSelected && <Check className={styles.objectiveCheck} size={16} />}
                  </button>
                );
              })}
            </div>

            <div className={styles.actions}>
              <button className={styles.ghostButton} onClick={handlePrev}>
                <ChevronLeft size={18} /> Voltar
              </button>
              <button
                className={styles.primaryButton}
                onClick={handleNext}
                disabled={!selectedObjective}
              >
                {selectedObjective ? 'Continuar' : 'Escolha um objetivo'} <ArrowRight size={18} />
              </button>
            </div>
            <button className={styles.skipButton} onClick={handleNext}>
              Prefiro não dizer agora
            </button>
          </div>
        )}

        {/* ── Passo 4: Seleção de perfil ───────────────────────────────── */}
        {step === 4 && (
          <div className={styles.stepContent} key="step-4">
            <h2 className={styles.title}>Qual é o seu perfil de investidor?</h2>
            <p className={styles.desc}>
              Isso define sua estratégia inicial de alocação — a base do rebalanceamento.{' '}
              <span className={styles.mutável}>Você pode alterar depois.</span>
            </p>

            {/* Hint que desaparece após primeira seleção */}
            {!hintDismissed && (
              <div className={styles.hint}>
                👆 Toque em um perfil para selecioná-lo
              </div>
            )}

            <div className={styles.profilesGrid}>
              {PROFILES.map((p) => {
                const isSelected = selectedProfile === p.id;
                return (
                  <div
                    key={p.id}
                    className={`${styles.profileOption} ${isSelected ? styles.selected : ''}`}
                    style={isSelected ? { borderColor: p.color, boxShadow: `0 0 0 1px ${p.color}, 0 4px 20px ${p.color}22` } : {}}
                    onClick={() => handleSelectProfile(p.id)}
                  >
                    <div className={styles.profileHeader}>
                      <div className={styles.profileTitleRow}>
                        <span className={styles.profileEmoji}>{p.emoji}</span>
                        <h3>{p.title}</h3>
                        {p.badge && <span className={styles.popularBadge}>{p.badge}</span>}
                      </div>
                      {isSelected && <Check className={styles.checkIcon} size={20} style={{ color: p.color }} />}
                    </div>

                    <p className={styles.profileDesc}>{p.desc}</p>

                    {/* Barra de alocação só aparece no selecionado */}
                    {isSelected && (
                      <>
                        <div className={styles.allocationBar}>
                          {p.categories.map((c, i) => (
                            <div
                              key={i}
                              className={styles.allocationSegment}
                              style={{ width: `${c.targetPercent}%`, backgroundColor: SEG_COLORS[i] }}
                              title={`${c.subclassName || c.className}: ${c.targetPercent}%`}
                            />
                          ))}
                        </div>
                        <div className={styles.allocationLegend}>
                          {p.categories.map((c, i) => (
                            <span key={i} style={{ color: SEG_COLORS[i] }}>
                              {c.targetPercent}% {c.className === 'Renda Variável' ? c.subclassName : c.className}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={styles.actions}>
              <button className={styles.ghostButton} onClick={handlePrev}>
                <ChevronLeft size={18} /> Voltar
              </button>
              <button
                className={styles.primaryButton}
                onClick={handleNext}
                disabled={!selectedProfile}
                title={!selectedProfile ? 'Selecione um perfil para continuar' : ''}
              >
                {selectedProfile ? 'Confirmar perfil' : 'Selecione um perfil'} <ArrowRight size={18} />
              </button>
            </div>
            <button
              className={styles.skipButton}
              onClick={() => { setSelectedProfile('moderado'); handleNext(); }}
            >
              Pular e configurar depois
            </button>
          </div>
        )}

        {/* ── Passo 5: Conclusão ───────────────────────────────────────── */}
        {step === 5 && (
          <div className={`${styles.stepContent} ${styles.successStep}`} key="step-5">
            <div className={styles.successIconWrapper}>
              <PartyPopper size={40} />
            </div>

            <h2 className={styles.title}>
              Tudo pronto, {firstName}!
            </h2>

            <div className={styles.successBadges}>
              <span className={styles.successProfile}>
                <span className={styles.successProfileEmoji}>{selectedProfileData?.emoji ?? '⚖️'}</span>
                Perfil <strong>&nbsp;{selectedProfileData?.title ?? 'Moderado'}</strong>
              </span>
              {selectedObjectiveData && (
                <span className={styles.successProfile}>
                  <span className={styles.successProfileEmoji}>{selectedObjectiveData.emoji}</span>
                  Foco em <strong>&nbsp;{selectedObjectiveData.title}</strong>
                </span>
              )}
            </div>

            <div className={styles.successChecklist}>
              <div><Check size={15} /> Estratégia de alocação criada</div>
              <div><Check size={15} /> Rebalanceamento configurado</div>
              <div><Check size={15} /> Monitoramento de impostos ativo</div>
              <div><Check size={15} /> Análise com IA disponível</div>
            </div>

            <p className={styles.desc}>
              Falta só uma coisa: seus ativos. Cadastre-os e veja o
              InvestMap começar a trabalhar por você em tempo real.
            </p>

            <div className={styles.successActions}>
              <button
                className={styles.primaryButton}
                onClick={() => handleComplete('add-asset')}
              >
                <PlusCircle size={20} />
                Adicionar meu primeiro ativo
              </button>

              <button
                className={styles.importB3Button}
                onClick={handleImportB3}
              >
                <FileSpreadsheet size={18} />
                Já invisto — importar extrato da B3
              </button>

              <button
                className={styles.ghostButton}
                onClick={() => handleComplete('dashboard')}
              >
                Explorar o dashboard primeiro
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
