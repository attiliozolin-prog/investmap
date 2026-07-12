'use client';

import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';
import styles from './LegalLayout.module.css';

export default function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.logoIcon}><Compass size={18} /></div>
            <span>InvestMap</span>
          </div>
          <Link href="/" className={styles.back}>
            <ArrowLeft size={15} /> Voltar ao app
          </Link>
        </header>

        <h1 className={styles.title}>{title}</h1>
        <p className={styles.updated}>Última atualização: {updatedAt}</p>

        <div className={styles.content}>{children}</div>

        <footer className={styles.footer}>
          <Link href="/privacidade">Política de Privacidade</Link>
          <span aria-hidden>·</span>
          <Link href="/termos">Termos de Uso</Link>
        </footer>
      </div>
    </div>
  );
}
