'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import styles from './FirstUseTip.module.css';

interface Tip {
  title: string;
  description: string;
  /** CSS position: { top, left, right, bottom } */
  position?: React.CSSProperties;
}

const STORAGE_KEY = 'investmap_first_use_done';

const TIPS: Tip[] = [
  {
    title: '📊 Dashboard',
    description: 'Aqui você acompanha o resumo da sua carteira: valor total, lucro/prejuízo e saúde da estratégia.',
    position: { top: '120px', left: '50%', transform: 'translateX(-50%)' },
  },
  {
    title: '📈 Ativos',
    description: 'Na aba Ativos, adicione e gerencie cada investimento. O InvestMap sugere automaticamente onde comprar ou vender.',
    position: { top: '120px', left: '50%', transform: 'translateX(-50%)' },
  },
  {
    title: '💰 Finanças',
    description: 'Controle seus gastos mensais: boletos, assinaturas e receitas. Descubra quanto tempo seu patrimônio sustenta seu padrão de vida.',
    position: { top: '120px', left: '50%', transform: 'translateX(-50%)' },
  },
];

interface FirstUseTipProps {
  /** Se true, mostra o tour mesmo que já tenha sido visto */
  force?: boolean;
}

export default function FirstUseTip({ force }: FirstUseTipProps) {
  const [currentTip, setCurrentTip] = useState(0);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (force) {
      setDismissed(false);
      return;
    }
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setDismissed(false);
    } catch { /* SSR */ }
  }, [force]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* */ }
  }, []);

  const next = () => {
    if (currentTip < TIPS.length - 1) {
      setCurrentTip(prev => prev + 1);
    } else {
      dismiss();
    }
  };

  if (dismissed) return null;

  const tip = TIPS[currentTip];

  return (
    <>
      <div className={styles.tipOverlay} onClick={dismiss} />
      <div className={styles.tipCard} style={tip.position}>
        <div className={styles.tipTitle}>
          <Sparkles size={14} /> {tip.title}
        </div>
        <div className={styles.tipDesc}>{tip.description}</div>
        <div className={styles.tipActions}>
          <div className={styles.tipDots}>
            {TIPS.map((_, i) => (
              <span
                key={i}
                className={`${styles.tipDot} ${i === currentTip ? styles.tipDotActive : ''}`}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.tipSkip} onClick={dismiss}>
              Pular tour
            </button>
            <button className={styles.tipBtn} onClick={next}>
              {currentTip < TIPS.length - 1 ? 'Próximo' : 'Entendi!'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
