'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { StrategyCategory } from '@/types';
import {
  TrendingUp, Wallet, Receipt, Sparkles,
  PlusCircle, ArrowRight, Check, ChevronLeft,
  Shield, Scale, Rocket, PartyPopper
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
  const [step, setStep] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);

  const TOTAL_STEPS = 4;

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'Investidor';

  const selectedProfileData = PROFILES.find(p => p.id === selectedProfile);

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
    } else {
      localStorage.removeItem('investmap_test_onboarding');
    }

    onFinish?.(action);
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
              Sua central de controle financeiro. Vamos configurar seu perfil
              para que o app trabalhe por você desde o primeiro dia.
            </p>

            <button className={styles.primaryButton} onClick={handleNext}>
              Começar configuração <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ── Passo 2: Tour de funcionalidades ─────────────────────────── */}
        {step === 2 && (
          <div className={styles.stepContent} key="step-2">
            <h2 className={styles.title}>O que você vai encontrar aqui</h2>
            <p className={styles.desc}>
              Tudo o que você precisa para investir com inteligência, em um só lugar.
            </p>

            <div className={styles.featuresList}>
              <div className={styles.featureItem} style={{ animationDelay: '0ms' }}>
                <div className={styles.featureIcon} style={{ color: '#8B5CF6', background: 'rgba(139,92,246,0.12)' }}>
                  <TrendingUp size={22} />
                </div>
                <div>
                  <h4>Carteira & Rebalanceamento</h4>
                  <p>Veja todos seus ativos em tempo real e saiba exatamente quanto aportar em cada categoria.</p>
                </div>
              </div>

              <div className={styles.featureItem} style={{ animationDelay: '80ms' }}>
                <div className={styles.featureIcon} style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.12)' }}>
                  <Wallet size={22} />
                </div>
                <div>
                  <h4>Controle Financeiro</h4>
                  <p>Registre aportes, retiradas e acompanhe a evolução do seu patrimônio ao longo do tempo.</p>
                </div>
              </div>

              <div className={styles.featureItem} style={{ animationDelay: '160ms' }}>
                <div className={styles.featureIcon} style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.12)' }}>
                  <Receipt size={22} />
                </div>
                <div>
                  <h4>Assistente de Impostos</h4>
                  <p>Calcule o DARF automaticamente e nunca perca o prazo. Controla a isenção de R$20k em ações.</p>
                </div>
              </div>

              <div className={styles.featureItem} style={{ animationDelay: '240ms' }}>
                <div className={styles.featureIcon} style={{ color: '#10B981', background: 'rgba(16,185,129,0.12)' }}>
                  <Sparkles size={22} />
                </div>
                <div>
                  <div className={styles.featureTitleRow}>
                    <h4>Análise com IA</h4>
                    <span className={styles.featureBadge}>Destaque</span>
                  </div>
                  <p>Receba insights personalizados sobre sua carteira gerados por Inteligência Artificial.</p>
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.ghostButton} onClick={handlePrev}>
                <ChevronLeft size={18} /> Voltar
              </button>
              <button className={styles.primaryButton} onClick={handleNext}>
                Continuar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── Passo 3: Seleção de perfil ───────────────────────────────── */}
        {step === 3 && (
          <div className={styles.stepContent} key="step-3">
            <h2 className={styles.title}>Qual é o seu perfil de investidor?</h2>
            <p className={styles.desc}>
              Isso define sua estratégia inicial de alocação.{' '}
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
          </div>
        )}

        {/* ── Passo 4: Conclusão ───────────────────────────────────────── */}
        {step === 4 && (
          <div className={`${styles.stepContent} ${styles.successStep}`} key="step-4">
            <div className={styles.successIconWrapper}>
              <PartyPopper size={40} />
            </div>

            <h2 className={styles.title}>
              Tudo configurado!
            </h2>

            <div className={styles.successProfile}>
              <span className={styles.successProfileEmoji}>{selectedProfileData?.emoji}</span>
              <span>Perfil <strong>{selectedProfileData?.title}</strong> ativado</span>
            </div>

            <p className={styles.desc}>
              Agora adicione seu primeiro ativo e veja o InvestMap
              começar a trabalhar por você em tempo real.
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
