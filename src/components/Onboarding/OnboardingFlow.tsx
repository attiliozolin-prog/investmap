'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { StrategyCategory } from '@/types';
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

export default function OnboardingFlow() {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const handleNext = () => setStep(2);
  
  const handleComplete = () => {
    const profile = PROFILES.find(p => p.id === selectedProfile);
    if (profile) {
      completeOnboarding(profile.categories);
    } else {
      // Default fallback
      completeOnboarding(PROFILES[1].categories);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {step === 1 && (
           <div className={styles.stepContent}>
             <div className={styles.iconWrapper}>
               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
             </div>
             <h2 className={styles.title}>Bem-vindo ao InvestMap</h2>
             <p className={styles.desc}>
               Antes de começarmos a analisar sua carteira, precisamos definir sua <strong>Estratégia Ideal</strong>. Ela vai nos dizer os percentuais-alvo que você deseja manter em cada classe de ativo (Ações, FIIs, Renda Fixa).
             </p>
             <button className={styles.primaryButton} onClick={handleNext}>Configurar Estratégia</button>
           </div>
        )}

        {step === 2 && (
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
                            <svg className={styles.checkIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
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
               <button className={styles.secondaryButton} onClick={() => setStep(1)}>Voltar</button>
               <button className={styles.primaryButton} onClick={handleComplete} disabled={!selectedProfile}>
                 Concluir Onboarding
               </button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
