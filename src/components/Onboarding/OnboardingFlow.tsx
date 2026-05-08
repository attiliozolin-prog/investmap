'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { StrategyCategory } from '@/types';
import { Target, BarChart2, FileText, Brain, PlusCircle, ArrowRight, Check } from 'lucide-react';
import styles from './OnboardingFlow.module.css';

const PROFILES = [
  {
    id: 'conservador',
    title: 'Conservador',
    desc: 'Foco em segurança e preservação de capital com retornos previsíveis.',
    categories: [
      { className: 'Renda Fixa', subclassName: 'Tesouro Direto', targetPercent: 80 },
      { className: 'Renda Variável', subclassName: 'Ações - Dividendos', targetPercent: 10 },
      { className: 'Renda Variável', subclassName: 'FIIs', targetPercent: 10 },
    ] as Omit<StrategyCategory, 'id' | 'strategyId'>[]
  },
  {
    id: 'moderado',
    title: 'Moderado',
    desc: 'Equilíbrio ideal entre crescimento patrimonial e proteção contra riscos.',
    categories: [
      { className: 'Renda Fixa', subclassName: 'CDBs e Tesouro', targetPercent: 50 },
      { className: 'Renda Variável', subclassName: 'Ações - Brasil', targetPercent: 20 },
      { className: 'Renda Variável', subclassName: 'Ações - Exterior', targetPercent: 10 },
      { className: 'Renda Variável', subclassName: 'FIIs', targetPercent: 20 },
    ] as Omit<StrategyCategory, 'id' | 'strategyId'>[]
  },
  {
    id: 'arrojado',
    title: 'Arrojado',
    desc: 'Foco em maximização a longo prazo, tolerando maior volatilidade.',
    categories: [
      { className: 'Renda Fixa', subclassName: 'Reserva de Oportunidade', targetPercent: 20 },
      { className: 'Renda Variável', subclassName: 'Ações - Valor', targetPercent: 30 },
      { className: 'Renda Variável', subclassName: 'Exterior', targetPercent: 30 },
      { className: 'Renda Variável', subclassName: 'FIIs', targetPercent: 20 },
    ] as Omit<StrategyCategory, 'id' | 'strategyId'>[]
  }
];

interface OnboardingFlowProps {
  onFinish?: (action: 'add-asset' | 'dashboard') => void;
}

export default function OnboardingFlow({ onFinish }: OnboardingFlowProps) {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const handleNext = () => setStep(step + 1);
  const handlePrev = () => setStep(step - 1);
  
  const handleComplete = (action: 'add-asset' | 'dashboard') => {
    let profile = PROFILES.find(p => p.id === selectedProfile);
    if (!profile) {
      profile = PROFILES[1]; // Default fallback
    }
    completeOnboarding(profile.categories);
    if (onFinish) {
      onFinish(action);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Passo 1: Boas Vindas */}
        {step === 1 && (
           <div className={styles.stepContent}>
             <div className={styles.iconWrapper}>
               <Target size={40} />
             </div>
             <h2 className={styles.title}>Bem-vindo ao InvestMap</h2>
             <p className={styles.desc}>
               O seu novo centro de controle financeiro. Antes de começarmos a analisar sua carteira e maximizar seus rendimentos, vamos configurar o seu espaço.
             </p>
             <button className={styles.primaryButton} onClick={handleNext}>
               Começar Tour <ArrowRight size={18} style={{ marginLeft: 8 }} />
             </button>
           </div>
        )}

        {/* Passo 2: Funcionalidades (Tour) */}
        {step === 2 && (
           <div className={styles.stepContent}>
             <h2 className={styles.title}>Conheça as Ferramentas</h2>
             <p className={styles.desc}>O InvestMap foi construído para dar controle total sobre seus investimentos e impostos.</p>
             
             <div className={styles.featuresList}>
               <div className={styles.featureItem}>
                 <div className={styles.featureIcon}><BarChart2 size={24} /></div>
                 <div>
                   <h4>Controle & Rebalanceamento</h4>
                   <p>Mantenha sua carteira alinhada à sua estratégia ideal de forma automática.</p>
                 </div>
               </div>
               <div className={styles.featureItem}>
                 <div className={styles.featureIcon}><FileText size={24} /></div>
                 <div>
                   <h4>Histórico & Finanças</h4>
                   <p>Acompanhe a evolução patrimonial e a gestão de entradas e saídas.</p>
                 </div>
               </div>
               <div className={styles.featureItem}>
                 <div className={styles.featureIcon} style={{ color: '#F59E0B', background: 'rgba(245, 158, 11, 0.1)' }}><FileText size={24} /></div>
                 <div>
                   <h4>Assistente de Impostos</h4>
                   <p>Cálculo automático de DARF e controle de isenções (ex: R$20k em Ações).</p>
                 </div>
               </div>
               <div className={styles.featureItem}>
                 <div className={styles.featureIcon} style={{ color: '#10B981', background: 'rgba(16, 185, 129, 0.1)' }}><Brain size={24} /></div>
                 <div>
                   <h4>Inteligência Artificial</h4>
                   <p>Receba insights gerados por IA baseados na composição da sua carteira.</p>
                 </div>
               </div>
             </div>

             <div className={styles.actions}>
               <button className={styles.secondaryButton} onClick={handlePrev}>Voltar</button>
               <button className={styles.primaryButton} onClick={handleNext}>
                 Continuar <ArrowRight size={18} style={{ marginLeft: 8 }} />
               </button>
             </div>
           </div>
        )}

        {/* Passo 3: Configuração da Estratégia */}
        {step === 3 && (
           <div className={styles.stepContent}>
             <h2 className={styles.title}>Qual é o seu Perfil?</h2>
             <p className={styles.desc}>Escolha uma distribuição inicial. Você poderá alterá-la e personalizá-la completamente na aba de Estratégias mais tarde.</p>

             <div className={styles.profilesGrid}>
                {PROFILES.map((p) => (
                  <div 
                    key={p.id} 
                    className={`${styles.profileOption} ${selectedProfile === p.id ? styles.selected : ''}`}
                    onClick={() => setSelectedProfile(p.id)}
                  >
                    <div className={styles.profileHeader}>
                        <h3>{p.title}</h3>
                        {selectedProfile === p.id && (
                            <Check className={styles.checkIcon} size={20} />
                        )}
                    </div>
                    <p className={styles.profileDesc}>{p.desc}</p>
                    <div className={styles.allocationBar}>
                      {p.categories.map((c, i) => (
                         <div 
                           key={i} 
                           className={styles.allocationSegment} 
                           style={{ 
                             width: `${c.targetPercent}%`, 
                             backgroundColor: i === 0 ? '#8B5CF6' : i === 1 ? '#3B82F6' : i === 2 ? '#10B981' : '#F59E0B' 
                           }}
                           title={`${c.className}: ${c.subclassName} - ${c.targetPercent}%`}
                         />
                      ))}
                    </div>
                    <div className={styles.allocationLegend}>
                        {p.categories.map((c, i) => (
                             <span key={i}>{c.targetPercent}% {c.className === 'Renda Variável' ? c.subclassName : c.className}</span>
                        ))}
                    </div>
                  </div>
                ))}
             </div>
             
             <div className={styles.actions}>
               <button className={styles.secondaryButton} onClick={handlePrev}>Voltar</button>
               <button className={styles.primaryButton} onClick={handleNext} disabled={!selectedProfile}>
                 Continuar <ArrowRight size={18} style={{ marginLeft: 8 }} />
               </button>
             </div>
           </div>
        )}

        {/* Passo 4: Conclusão e Ação */}
        {step === 4 && (
           <div className={styles.stepContent} style={{ alignItems: 'center', textAlign: 'center' }}>
             <div className={styles.iconWrapper} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
               <Check size={40} />
             </div>
             <h2 className={styles.title}>Tudo Pronto!</h2>
             <p className={styles.desc}>
               Seu perfil foi configurado. Agora é hora de começar a montar a sua carteira. Adicione seu primeiro ativo para ver a mágica acontecer!
             </p>
             
             <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
               <button 
                 className={styles.primaryButton} 
                 onClick={() => handleComplete('add-asset')}
                 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1.2rem' }}
               >
                 <PlusCircle size={20} />
                 Adicionar meu primeiro ativo
               </button>
               
               <button 
                 className={styles.secondaryButton} 
                 onClick={() => handleComplete('dashboard')}
                 style={{ border: 'none', background: 'transparent' }}
               >
                 Ir para o Dashboard vazio
               </button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
