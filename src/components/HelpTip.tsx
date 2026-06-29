'use client';

import { useState } from 'react';
import styles from './HelpTip.module.css';

interface HelpTipProps {
  text: string;
}

export default function HelpTip({ text }: HelpTipProps) {
  const [show, setShow] = useState(false);

  return (
    <span
      className={styles.helpTipWrapper}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.preventDefault(); setShow(v => !v); }}
    >
      <span className={styles.helpTipBtn} aria-label="Ajuda" role="button" tabIndex={0}>?</span>
      {show && <span className={styles.helpTipPopover}>{text}</span>}
    </span>
  );
}
