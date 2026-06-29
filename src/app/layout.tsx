import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InvestMap — Controle de Investimentos',
  description: 'Acompanhe sua carteira de investimentos, defina sua estratégia e saiba quando rebalancear. Simples, visual e acessível.',
  keywords: 'investimentos, carteira, rebalanceamento, estratégia, renda variável, renda fixa',
  manifest: '/manifest.json',
  appleWebApp: {
    title: 'InvestMap',
    statusBarStyle: 'black-translucent',
    capable: true,
  },
};

export const viewport = {
  themeColor: '#0F0F1A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
