'use client';

import React from 'react';
import {
  TrendingUp, Wallet, Receipt, Sparkles, ArrowRight, Check,
  Target, PieChart, LineChart, ScanLine, ShieldCheck, Lock, Gift,
  UserPlus, SlidersHorizontal, Rocket,
} from 'lucide-react';
import styles from './LandingPage.module.css';

/**
 * Landing page pública exibida antes do login. Apresenta as principais
 * funcionalidades (mesmo conteúdo do tour do onboarding) para que um
 * visitante conheça a ferramenta antes de criar a conta.
 */

interface LandingPageProps {
  onLogin: () => void;
  onSignup: () => void;
}

// ─── Mini-previews (versões estáticas dos previews do onboarding) ────────────

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

function PreviewAiImport() {
  const rows = [
    { n: 'Uber', c: 'Transporte', v: 'R$ 32,90' },
    { n: 'Amazon', c: 'Compras', v: 'R$ 156,00' },
    { n: 'Academia', c: 'Saúde', v: 'R$ 120,00' },
  ];
  return (
    <div className={styles.previewBox}>
      <div className={styles.pvScanHeader}>
        <ScanLine size={14} />
        <span>Fatura PDF → 12 itens identificados</span>
      </div>
      {rows.map(r => (
        <div key={r.n} className={styles.pvScanRow}>
          <span className={styles.pvLabel} style={{ width: 70 }}>{r.n}</span>
          <span className={styles.pvScanTag}>{r.c}</span>
          <span className={styles.pvScanValue}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

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

// ─── Funcionalidades (mesmo conteúdo do tour do onboarding) ──────────────────

const FEATURES = [
  {
    id: 'portfolio',
    Icon: LineChart,
    color: '#8B5CF6',
    tag: 'Carteira',
    title: 'Todos os seus ativos, em tempo real',
    desc: 'Ações, FIIs, ETFs, renda fixa e exterior em um só lugar, com cotações atualizadas automaticamente.',
    bullets: ['Cotações e variação em tempo real', 'Histórico completo de cada ativo', 'Rentabilidade por ativo e por classe'],
    preview: <PreviewPortfolio />,
  },
  {
    id: 'rebalance',
    Icon: PieChart,
    color: '#3B82F6',
    tag: 'Estratégia',
    title: 'Rebalanceamento sem planilha',
    desc: 'Defina sua alocação-alvo e o InvestMap calcula exatamente quanto aportar em cada categoria.',
    bullets: ['Alocação atual vs. alvo, sempre visível', 'Sugestão de aporte por categoria', 'Estratégia ajustável a qualquer momento'],
    preview: <PreviewRebalance />,
  },
  {
    id: 'finances',
    Icon: Wallet,
    color: '#10B981',
    tag: 'Finanças',
    title: 'Suas finanças pessoais conectadas',
    desc: 'Registre aportes e retiradas e acompanhe a evolução do patrimônio mês a mês.',
    bullets: ['Evolução patrimonial em gráficos', 'Aportes e retiradas organizados', 'Visão consolidada de tudo que você tem'],
    preview: <PreviewFinances />,
  },
  {
    id: 'ai-import',
    Icon: ScanLine,
    color: '#2DD4BF',
    tag: 'Finanças com IA',
    title: 'Lance gastos tirando uma foto',
    desc: 'Envie o PDF da fatura do cartão ou a foto de um boleto — a IA identifica cada item e sugere a categoria.',
    bullets: ['Leitura automática de faturas, boletos e recibos', 'Categorização sugerida automaticamente', 'Aceita foto, PDF e vários formatos de imagem'],
    preview: <PreviewAiImport />,
  },
  {
    id: 'goals',
    Icon: Target,
    color: '#EC4899',
    tag: 'Metas',
    title: 'Metas com projeção de chegada',
    desc: 'Defina objetivos financeiros e veja em quanto tempo você chega lá no seu ritmo atual de aportes.',
    bullets: ['Progresso visual de cada meta', 'Projeção de prazo com juros compostos', 'Simule aportes maiores e veja o impacto'],
    preview: <PreviewGoal />,
  },
  {
    id: 'taxes',
    Icon: Receipt,
    color: '#F59E0B',
    tag: 'Impostos',
    title: 'Imposto de renda no piloto automático',
    desc: 'O app monitora suas vendas, controla a isenção de R$ 20 mil em ações e calcula o DARF por você.',
    bullets: ['Cálculo automático do DARF mensal', 'Controle da isenção de R$ 20 mil', 'Compensação de prejuízos acumulados'],
    preview: <PreviewTaxes />,
  },
  {
    id: 'ai',
    Icon: Sparkles,
    color: '#22D3EE',
    tag: 'Inteligência Artificial',
    title: 'Um analista de IA na sua carteira',
    desc: 'Receba análises personalizadas sobre concentração, diversificação e oportunidades de melhoria.',
    bullets: ['Insights sob medida para a sua carteira', 'Alertas de concentração e desvios', 'Linguagem simples, sem jargão'],
    preview: <PreviewAi />,
  },
];

const STEPS = [
  {
    Icon: UserPlus,
    title: 'Crie sua conta gratuita',
    desc: 'Só e-mail e senha. Sem cartão de crédito, sem pegadinha.',
  },
  {
    Icon: SlidersHorizontal,
    title: 'Configure em 2 minutos',
    desc: 'Escolha seu perfil de investidor e o app monta sua estratégia de alocação inicial.',
  },
  {
    Icon: Rocket,
    title: 'Adicione seus ativos',
    desc: 'Cadastre manualmente ou importe seu extrato da B3 — e veja tudo funcionando em tempo real.',
  },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function LandingPage({ onLogin, onSignup }: LandingPageProps) {
  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIconBox}>
            <TrendingUp size={18} />
          </div>
          Invest<span>Map</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.loginButton} onClick={onLogin}>
            Entrar
          </button>
          <button className={styles.signupButtonSmall} onClick={onSignup}>
            Criar conta
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className={styles.hero}>
        <div className={styles.badge}>Acesso antecipado · Feito para o investidor brasileiro</div>
        <h1 className={styles.title}>O controle que seus investimentos merecem.</h1>
        <p className={styles.subtitle}>
          Carteira, rebalanceamento, finanças pessoais, metas, impostos e análise com IA —
          tudo em um só lugar. Simples, visual e direto ao ponto.
        </p>

        <div className={styles.ctaGroup}>
          <button className={styles.ctaButton} onClick={onSignup}>
            Começar grátis <ArrowRight size={18} />
          </button>
          <button className={styles.ctaSecondary} onClick={onLogin}>
            Já tenho conta
          </button>
        </div>

        <div className={styles.heroNote}>
          <div className={styles.heroNoteIcon}>
            <Sparkles size={16} />
          </div>
          <p>
            <strong>Gratuito durante o acesso antecipado.</strong>
            <span>Quem entra agora garante condições especiais quando os planos chegarem.</span>
          </p>
        </div>

        <div className={styles.pillRow}>
          <span className={styles.pill}><LineChart size={13} /> Carteira</span>
          <span className={styles.pill}><PieChart size={13} /> Estratégia</span>
          <span className={styles.pill}><Wallet size={13} /> Finanças</span>
          <span className={styles.pill}><Target size={13} /> Metas</span>
          <span className={styles.pill}><Receipt size={13} /> Impostos</span>
          <span className={styles.pill}><Sparkles size={13} /> IA</span>
        </div>
      </main>

      {/* ── Funcionalidades ── */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Tudo o que você precisa para poupar e investir com método</h2>
        <p className={styles.sectionSubtitle}>
          Chega de planilhas espalhadas. O InvestMap reúne o ciclo completo do investidor.
        </p>

        <div className={styles.featureGrid}>
          {FEATURES.map(f => (
            <article key={f.id} className={styles.featureCard}>
              <div className={styles.featureHeader}>
                <div className={styles.featureIcon} style={{ color: f.color, background: `${f.color}1F` }}>
                  <f.Icon size={22} />
                </div>
                <span className={styles.featureTag} style={{ color: f.color, borderColor: `${f.color}44` }}>
                  {f.tag}
                </span>
              </div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
              {f.preview}
              <ul className={styles.featureBullets}>
                {f.bullets.map((b, i) => (
                  <li key={i}>
                    <Check size={14} style={{ color: f.color, flexShrink: 0 }} /> {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>Comece em menos de 2 minutos</h2>
        <div className={styles.stepsGrid}>
          {STEPS.map((s, i) => (
            <div key={i} className={styles.stepCard}>
              <div className={styles.stepNumber}>{i + 1}</div>
              <div className={styles.stepIcon}><s.Icon size={22} /></div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Confiança ── */}
      <section className={styles.trust}>
        <div className={styles.trustItem}>
          <Gift size={18} />
          <div>
            <strong>Grátis para começar</strong>
            <p>Sem cartão de crédito e sem compromisso. Entre agora e garanta vantagens.</p>
          </div>
        </div>
        <div className={styles.trustItem}>
          <Lock size={18} />
          <div>
            <strong>Seus dados são seus</strong>
            <p>Conta protegida por login e senha, dados criptografados em trânsito.</p>
          </div>
        </div>
        <div className={styles.trustItem}>
          <ShieldCheck size={18} />
          <div>
            <strong>Você no controle</strong>
            <p>O InvestMap te mostra o caminho, mas quem decide é você.</p>
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className={styles.finalCta}>
        <h2 className={styles.finalCtaTitle}>Faça parte do InvestMap desde o começo</h2>
        <p className={styles.finalCtaSubtitle}>
          Crie sua conta gratuita, configure em 2 minutos e garanta suas vantagens.
        </p>
        <button className={styles.ctaButton} onClick={onSignup}>
          Começar grátis <ArrowRight size={18} />
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <p className={styles.disclaimer}>
          O InvestMap é uma ferramenta de organização financeira e educação.{' '}
          <strong>Não constitui recomendação de investimento</strong> nem consultoria financeira ou tributária.
        </p>
        <div className={styles.legalLinks}>
          <a href="/privacidade">Privacidade</a>
          <span aria-hidden>·</span>
          <a href="/termos">Termos de uso</a>
        </div>
      </footer>
    </div>
  );
}
