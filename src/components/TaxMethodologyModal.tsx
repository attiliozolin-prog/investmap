'use client';

import { X, Info, TrendingDown, ScrollText } from 'lucide-react';
import styles from './TaxMethodologyModal.module.css';

interface Props {
  onClose: () => void;
}

// Espelha 1:1 as regras implementadas em src/lib/taxCalculator.ts — fonte
// única de verdade sobre o motor de cálculo. Qualquer mudança lá deve ser
// refletida aqui.
const ASSET_RULES: { label: string; rate: string; exemption: string; withheld?: boolean }[] = [
  { label: 'Ação (B3)', rate: '15% sobre o lucro', exemption: 'Isento se o total de vendas de ações no mês ≤ R$ 20.000' },
  { label: 'BDR (Recibo de Ação Estrangeira)', rate: '15% sobre o lucro', exemption: 'Sem isenção de R$ 20 mil — a isenção da Lei 11.033/2004 vale só para ações' },
  { label: 'ETF de Renda Variável', rate: '15% sobre o lucro', exemption: 'Sem isenção de R$ 20 mil' },
  { label: 'FII (Fundo Imobiliário)', rate: '20% sobre o lucro', exemption: 'Sem isenção' },
  { label: 'ETF de Renda Fixa', rate: 'Tabela regressiva: 25% → 15%, pelo prazo médio da carteira do fundo', exemption: 'Retido na fonte pela corretora — não gera DARF', withheld: true },
  { label: 'Renda Fixa (CDB, Tesouro Direto etc.)', rate: 'Tabela regressiva: 22,5% → 15%, conforme o prazo da aplicação', exemption: 'Retido na fonte pelo banco/corretora — não gera DARF', withheld: true },
  { label: 'LCI / LCA', rate: '—', exemption: 'Isento de IR para pessoa física', withheld: true },
  { label: 'Criptoativo (exchange nacional)', rate: '15% a 22,5% progressivo sobre o lucro, acima do limite de isenção', exemption: 'Isento se o total de vendas de cripto no mês ≤ R$ 35.000' },
];

const COMPENSATION_RULES = [
  { label: 'Ações, ETFs e BDRs (operações comuns em bolsa)', detail: 'Prejuízo compensa lucros futuros entre si, dentro desse grupo — inclusive prejuízo com ações em mês de vendas abaixo de R$ 20 mil. Lucro isento de ações não consome o prejuízo acumulado.' },
  { label: 'FII', detail: 'Prejuízo compensa apenas lucros futuros em vendas de outros FIIs — separado das demais ações/ETFs.' },
  { label: 'Criptoativo (exchange nacional), Renda Fixa, LCI/LCA', detail: 'Prejuízo NÃO é compensável — a apuração é mensal e definitiva.' },
];

const LIMITATIONS = [
  'Day trade (alíquota de 20%, com apuração separada) não é diferenciado — todas as vendas são tratadas como operação comum.',
  'O regime de aplicações no exterior (Lei 14.754/2023, apuração anual) não é coberto — só o regime nacional.',
  'O IRRF de 0,005% sobre vendas ("dedo-duro") não é abatido do DARF, e o vencimento não considera feriados nacionais.',
  'As isenções de R$ 20 mil (ações) e R$ 35 mil (cripto) consideram apenas as vendas registradas neste app — se você vendeu o mesmo tipo de ativo em outra corretora/carteira não cadastrada aqui, o limite real pode já estar ultrapassado.',
];

const LEGAL_REFS = [
  'Lei 11.033/2004, art. 2º (alíquota de 15%) e art. 3º (isenção de R$ 20 mil em ações)',
  'Lei 8.668/93 (FII, ganho de capital a 20%)',
  'Lei 8.981/95, art. 21 (ganho de capital — tabela usada para criptoativos)',
  'IN RFB 1.888/2019 (criptoativos — obrigações e isenção de R$ 35 mil)',
  'IN RFB 1.585/2015 (ETFs; ETF de renda fixa retido na fonte)',
  'Lei 14.754/2023 (regime de aplicações no exterior — fora do escopo deste app)',
];

export default function TaxMethodologyModal({ onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Como calculamos seus impostos">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <ScrollText size={20} color="var(--color-primary)" />
            <h3 className={styles.title}>Como calculamos seus impostos</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        <p className={styles.intro}>
          Todo cálculo é feito automaticamente, com base na legislação vigente (revisada em jul/2026),
          no momento em que você registra uma venda. Nada é estimado &ldquo;no escuro&rdquo; — aqui está
          exatamente a regra aplicada para cada tipo de ativo.
        </p>

        <section>
          <h4 className={styles.sectionTitle}>Alíquotas e isenções por tipo de ativo</h4>
          <div className={styles.ruleList}>
            {ASSET_RULES.map((r) => (
              <div key={r.label} className={styles.ruleRow}>
                <div className={styles.ruleLabel}>
                  {r.label}
                  {r.withheld && <span className={styles.badgeWithheld}>retido na fonte</span>}
                </div>
                <div className={styles.ruleDetail}>{r.rate}</div>
                <div className={styles.ruleExemption}>{r.exemption}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4 className={styles.sectionTitle}>Como o IR é apurado</h4>
          <p className={styles.sectionText}>
            O imposto não é calculado venda a venda, e sim <strong>por mês</strong>, como exige a Receita. Para cada mês o app:
            (1) soma as vendas do mês por grupo — bolsa comum (ações, ETFs, BDRs), FII e cripto; (2) aplica as isenções
            olhando o <strong>total vendido no mês</strong>; (3) compensa lucros e prejuízos do mesmo mês e abate os
            prejuízos acumulados de meses anteriores do mesmo grupo; (4) aplica a alíquota e gera
            <strong> um DARF por mês</strong>: código 6015 (bolsa + FII) e 4600 (cripto). Se o DARF ficar abaixo de
            R$ 10, ele não é pago naquele mês — o valor passa para o mês seguinte.
          </p>
          <p className={styles.sectionText}>
            Tudo é recalculado sempre que uma venda é registrada, editada ou excluída — a ordem em que você lança
            as vendas não muda o resultado. Se o IR de um mês já pago aumentar, o app mostra o DARF complementar.
            Venda sem custo de aquisição conhecido fica fora do cálculo (senão o imposto incidiria sobre o valor
            inteiro) até você informar o custo.
          </p>
        </section>

        <section>
          <h4 className={styles.sectionTitle}>Já foi recolhido, ou preciso pagar?</h4>
          <p className={styles.sectionText}>
            <strong>Renda Fixa e ETF de Renda Fixa</strong> têm o IR retido na fonte pelo banco/corretora e
            <strong> LCI/LCA</strong> são isentas — nenhum deles gera DARF. Para os demais tipos, o DARF do mês fica
            <strong> pendente</strong> até você pagá-lo e marcar como pago aqui no app. Ele vence no último dia útil
            do mês seguinte ao da venda.
          </p>
        </section>

        <section>
          <h4 className={styles.sectionTitle}><TrendingDown size={14} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }}/>Compensação de prejuízos</h4>
          <div className={styles.compList}>
            {COMPENSATION_RULES.map((c) => (
              <div key={c.label} className={styles.compRow}>
                <strong>{c.label}</strong>
                <span>{c.detail}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4 className={styles.sectionTitle}>Limitações conhecidas</h4>
          <ul className={styles.limitList}>
            {LIMITATIONS.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </section>

        <section>
          <h4 className={styles.sectionTitle}>Base legal</h4>
          <ul className={styles.legalList}>
            {LEGAL_REFS.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </section>

        <div className={styles.notice}>
          <Info size={13} />
          <span>Isto é uma ferramenta de organização e educação financeira, não consultoria tributária. Para
          situações específicas ou dúvidas na declaração, consulte um contador ou a Receita Federal.</span>
        </div>
      </div>
    </div>
  );
}
