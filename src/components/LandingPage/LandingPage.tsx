'use client';

import React from 'react';
import styles from './LandingPage.module.css';

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.logoIcon}>
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
          Invest<span>Map</span>
        </div>
      </header>

      <main className={styles.hero}>
        <div className={styles.badge}>Novo</div>
        <h1 className={styles.title}>O controle que seus investimentos merecem.</h1>
        <p className={styles.subtitle}>
          Acompanhe sua carteira, defina sua estratégia ideal e saiba o momento exato de rebalancear seus ativos. Simples, visual e direto ao ponto.
        </p>
        <button className={styles.ctaButton} onClick={onStart}>
          Acessar Plataforma
        </button>
      </main>

      <section className={styles.features}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>
          </div>
          <h3 className={styles.featureTitle}>Estratégia Clara</h3>
          <p className={styles.featureDesc}>Defina os percentuais ideais para cada classe de ativo e veja como sua carteira se comporta em tempo real.</p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <h3 className={styles.featureTitle}>Acompanhamento</h3>
          <p className={styles.featureDesc}>Registre seus aportes e acompanhe a evolução do seu patrimônio com gráficos interativos.</p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m12 8 4 4-4 4M8 12h8"/></svg>
          </div>
          <h3 className={styles.featureTitle}>Rebalanceamento</h3>
          <p className={styles.featureDesc}>Receba orientações precisas de onde aportar para manter sua carteira alinhada aos seus objetivos de longo prazo.</p>
        </div>
      </section>
    </div>
  );
}
