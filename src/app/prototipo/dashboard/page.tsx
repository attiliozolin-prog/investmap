'use client';

/**
 * PROTÓTIPO — Novo Dashboard (visão "do zero")
 *
 * Não é código de produção: dados fictícios (espelhando a escala real da
 * carteira do usuário), nada é salvo, nenhum context do app é usado.
 *
 * Hierarquia de comando (referências: Copilot Money, Delta, Kinvo home):
 * 1. QUANTO EU TENHO — hero com patrimônio + gráfico de evolução integrado
 *    (hover com crosshair, períodos 3M/6M/1A/Tudo), e ao lado os 3 números
 *    de contexto: sobra do mês, sobrevivência e meta.
 * 2. O QUE PRECISA DE MIM — Central de Ações unificada e PRIORIZADA
 *    (DARF atrasado > boletos vencendo > rebalanceamento > confirmar
 *    previsto), cada item com valor e deep-link. Vazia = "tudo em dia".
 * 3. COMO ESTÃO OS PILARES — 4 cards navegáveis: Carteira, Finanças,
 *    Impostos, Estratégia. Resumo de 2-3 números + link.
 * 4. INSIGHTS — leituras automáticas cruzando os domínios (a mágica de
 *    ter tudo num app só: a sobra do mês vira sugestão de aporte).
 */

import { useMemo, useRef, useState } from 'react';
import {
  RefreshCw, Zap, ArrowRight, CheckCircle2, AlertTriangle, CalendarClock,
  Landmark, Wallet, Briefcase, Target, Sparkles, ShieldAlert, Lightbulb, Pencil, Check,
} from 'lucide-react';
import s from './proto.module.css';

// ─── Dados fictícios (escala espelhada da carteira real) ────────────────────

const PATRIMONIO = 292150.23;
const APORTADO = 352399.40;
const SOBRA_MES = 11706;
const CUSTO_MES = 14144;
const META_VALOR_INICIAL = 1000000;
const APORTE_IDEAL = 19097.56;

// Série de evolução patrimonial (24 meses)
const SERIE: { label: string; value: number }[] = [
  { label: 'Ago/24', value: 198400 }, { label: 'Set/24', value: 205100 },
  { label: 'Out/24', value: 212800 }, { label: 'Nov/24', value: 221500 },
  { label: 'Dez/24', value: 234200 }, { label: 'Jan/25', value: 241900 },
  { label: 'Fev/25', value: 238600 }, { label: 'Mar/25', value: 249300 },
  { label: 'Abr/25', value: 258000 }, { label: 'Mai/25', value: 266700 },
  { label: 'Jun/25', value: 262400 }, { label: 'Jul/25', value: 274100 },
  { label: 'Ago/25', value: 281800 }, { label: 'Set/25', value: 289500 },
  { label: 'Out/25', value: 296200 }, { label: 'Nov/25', value: 305900 },
  { label: 'Dez/25', value: 318600 }, { label: 'Jan/26', value: 311300 },
  { label: 'Fev/26', value: 320000 }, { label: 'Mar/26', value: 308700 },
  { label: 'Abr/26', value: 301400 }, { label: 'Mai/26', value: 297100 },
  { label: 'Jun/26', value: 288800 }, { label: 'Jul/26', value: PATRIMONIO },
];

const ALLOC = [
  { name: 'Renda Fixa', pct: 32.1, color: '#8B5CF6' },
  { name: 'Renda Variável', pct: 39.5, color: '#0891B2' },
  { name: 'Cripto', pct: 24.9, color: '#D97706' },
  { name: 'Caixa', pct: 3.5, color: '#DB2777' },
];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtFull = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

// ─── Gráfico de área com hover (linha 2px, wash 10%, ponto final ≥8px) ──────

const RANGES = [
  { id: '3m', label: '3M', points: 4 },
  { id: '6m', label: '6M', points: 7 },
  { id: '1a', label: '1A', points: 13 },
  { id: 'all', label: 'Tudo', points: SERIE.length },
] as const;
type RangeId = typeof RANGES[number]['id'];

function AreaChart({ data }: { data: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 720, H = 190, PX = 6, PT = 14, PB = 20;
  const min = Math.min(...data.map(d => d.value));
  const max = Math.max(...data.map(d => d.value));
  const span = max - min || 1;
  const x = (i: number) => PX + (i / (data.length - 1)) * (W - PX * 2);
  const y = (v: number) => PT + (1 - (v - min) / span) * (H - PT - PB);

  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `${PX},${H - PB} ${line} ${W - PX},${H - PB}`;
  const lastI = data.length - 1;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - PX) / (W - PX * 2)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const h = hover != null ? data[hover] : null;
  const first = data[0].value;
  const deltaPct = ((data[lastI].value - first) / first) * 100;

  return (
    <div className={s.chartWrap}>
      <svg
        ref={svgRef} className={s.chartSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        role="img" aria-label={`Evolução do patrimônio: ${deltaPct >= 0 ? 'alta' : 'queda'} de ${pct(Math.abs(deltaPct))} no período`}
      >
        <defs>
          <linearGradient id="protoAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#protoAreaFill)" />
        <polyline points={line} fill="none" stroke="#8B5CF6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {/* ponto final */}
        <circle cx={x(lastI)} cy={y(data[lastI].value)} r={4.5} fill="#8B5CF6" stroke="var(--color-surface, #12121D)" strokeWidth={2} />
        {/* crosshair de hover */}
        {h && hover != null && (
          <>
            <line x1={x(hover)} y1={PT} x2={x(hover)} y2={H - PB} stroke="var(--color-border, #252538)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(h.value)} r={4.5} fill="#8B5CF6" stroke="var(--color-surface, #12121D)" strokeWidth={2} />
          </>
        )}
      </svg>
      {h && hover != null && (
        <div className={s.chartTooltip} style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%` }}>
          {h.label}
          <strong>{fmtFull(h.value)}</strong>
        </div>
      )}
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function PrototipoDashboard() {
  const [range, setRange] = useState<RangeId>('1a');
  const [metaValor, setMetaValor] = useState(META_VALOR_INICIAL);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(META_VALOR_INICIAL));
  const [syncing, setSyncing] = useState(false);
  const [syncedAgo, setSyncedAgo] = useState('há 8 min');

  const data = useMemo(() => {
    const n = RANGES.find(r => r.id === range)!.points;
    return SERIE.slice(-n);
  }, [range]);

  const pl = PATRIMONIO - APORTADO;
  const plPct = (pl / APORTADO) * 100;
  const first = data[0].value;
  const rangeDelta = PATRIMONIO - first;
  const rangeDeltaPct = (rangeDelta / first) * 100;

  const survivalM = PATRIMONIO / CUSTO_MES;
  const goalPct = (PATRIMONIO / metaValor) * 100;

  const startEditGoal = () => {
    setGoalDraft(String(Math.round(metaValor)));
    setEditingGoal(true);
  };
  const saveGoal = () => {
    const num = parseInt(goalDraft.replace(/\D/g, ''), 10);
    if (num > 0) setMetaValor(num);
    setEditingGoal(false);
  };
  const burnPct = Math.round((CUSTO_MES / (CUSTO_MES + SOBRA_MES)) * 100);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const fakeSync = () => {
    if (syncing) return;
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setSyncedAgo('agora mesmo'); }, 1200);
  };

  // Central de ações: prioridade fixa (urgente → importante → oportunidade)
  const actions = [
    {
      icon: <AlertTriangle size={16} />, cls: s.aiUrgent,
      title: <>DARF de <strong>R$ 890,00</strong> atrasado (competência 06/2026)</>,
      sub: 'Multa e juros correm desde 31/07 — gere o DARF no Sicalc e marque como pago',
      go: 'Resolver', dest: '/impostos',
    },
    {
      icon: <CalendarClock size={16} />, cls: s.aiWarn,
      title: <>2 contas vencem em 3 dias · <strong>R$ 1.778,11</strong></>,
      sub: 'Convênio (dia 28) e Energia (dia 29) — ambas pendentes em Julho',
      go: 'Ver contas', dest: '/financas',
    },
    {
      icon: <Sparkles size={16} />, cls: s.aiInfo,
      title: <>Aporte de <strong>{fmt(APORTE_IDEAL)}</strong> em Bitcoin recoloca a carteira na meta</>,
      sub: '6 de 11 subclasses fora da tolerância — este aporte único resolve sem vender nada',
      go: 'Rebalancear', dest: '/carteira',
    },
    {
      icon: <CalendarClock size={16} />, cls: s.aiInfo,
      title: <>Fatura do cartão está <strong>≈ prevista</strong> em R$ 5.105</>,
      sub: 'Valor estimado pela média — confirme quando a fatura fechar',
      go: 'Confirmar', dest: '/financas',
    },
  ];

  return (
    <div className={s.page}>
      <div className={s.protoBar}>
        <span className={s.protoBadge}>PROTÓTIPO</span>
        Novo Dashboard — dados fictícios, nada é salvo
      </div>

      <div className={s.container}>

        {/* ── Saudação ── */}
        <div className={s.greetRow}>
          <div>
            <h1 className={s.greeting}>{greet}, Attilio 👋</h1>
            <div className={s.greetSub}>{today.charAt(0).toUpperCase() + today.slice(1)} · aqui está o retrato do seu dinheiro</div>
          </div>
          <button className={s.syncChip} onClick={fakeSync} title="Sincronizar cotações (Brapi)">
            <RefreshCw size={11} className={syncing ? s.syncSpin : undefined} />
            {syncing ? 'Sincronizando…' : `Preços ${syncedAgo}`}
          </button>
        </div>

        {/* ── Hero: patrimônio + evolução + stats laterais ── */}
        <section className={s.heroGrid} aria-label="Resumo do patrimônio">
          <div className={s.heroCard}>
            <div className={s.heroTopRow}>
              <div>
                <span className={s.heroLabel}>Patrimônio total</span>
                <div className={s.heroValue}>{fmtFull(PATRIMONIO)}</div>
                <span className={s.delta}>
                  <span className={pl >= 0 ? s.deltaGood : s.deltaBad}>
                    {pl >= 0 ? '▲' : '▼'} {fmt(Math.abs(pl))} ({pct(Math.abs(plPct))})
                  </span>
                  <span className={s.deltaRef}>desde o início</span>
                  <span className={rangeDelta >= 0 ? s.deltaGood : s.deltaBad} style={{ marginLeft: 8 }}>
                    {rangeDelta >= 0 ? '▲' : '▼'} {pct(Math.abs(rangeDeltaPct))}
                  </span>
                  <span className={s.deltaRef}>no período</span>
                </span>
              </div>
              <div className={s.rangeTabs} role="tablist" aria-label="Período do gráfico">
                {RANGES.map(r => (
                  <button key={r.id} role="tab" aria-selected={range === r.id}
                    className={`${s.rangeBtn} ${range === r.id ? s.rangeActive : ''}`}
                    onClick={() => setRange(r.id)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <AreaChart data={data} />
          </div>

          <div className={s.sideCol}>
            <button className={s.statCard} title="Ir para Finanças">
              <span className={s.statLabel}><Wallet size={11} /> Sobra de Julho</span>
              <span className={s.statValue} style={{ color: '#34D399' }}>{fmt(SOBRA_MES)}</span>
              <span className={s.statSub}>Você usou {burnPct}% das entradas</span>
              <div className={s.miniMeter}><div className={s.miniMeterFill} style={{ width: `${burnPct}%`, background: '#10B981' }} /></div>
            </button>
            <button className={s.statCard} title="Patrimônio ÷ custo mensal">
              <span className={s.statLabel}><ShieldAlert size={11} /> Sobrevivência</span>
              <span className={s.statValue}>{survivalM.toFixed(0)} meses</span>
              <span className={s.statSub}>≈ {(survivalM / 12).toFixed(1).replace('.', ',')} anos no seu padrão de vida</span>
            </button>
            <button className={s.statCard} title="Ir para a meta">
              <span className={s.statLabel}><Target size={11} /> Meta: R$ 1M</span>
              <span className={s.statValue} style={{ color: '#A78BFA' }}>{pct(goalPct)}</span>
              <span className={s.statSub}>ETA ~2033 no ritmo atual de aportes</span>
              <div className={s.statMeter}><div className={s.statMeterFill} style={{ width: `${goalPct}%` }} /></div>
            </button>
          </div>
        </section>

        {/* ── Central de Ações ── */}
        <section className={s.actionCard} aria-label="Ações pendentes">
          <div className={s.actionHead}>
            <Zap size={15} color="#A78BFA" /> Precisa de você
            <span className={s.actionCount}>{actions.length}</span>
          </div>
          {actions.length === 0 ? (
            <div className={s.actionEmpty}>
              <CheckCircle2 size={18} /> Tudo em dia — nenhuma ação pendente. Bom trabalho!
            </div>
          ) : (
            actions.map((a, i) => (
              <button key={i} className={s.actionRow} title={`No app real navega para ${a.dest}`}>
                <span className={`${s.actionIcon} ${a.cls}`}>{a.icon}</span>
                <span className={s.actionBody}>
                  <div className={s.actionTitle}>{a.title}</div>
                  <div className={s.actionSub}>{a.sub}</div>
                </span>
                <span className={s.actionGo}><span>{a.go}</span> <ArrowRight size={13} /></span>
              </button>
            ))
          )}
        </section>

        {/* ── Pilares ── */}
        <section className={s.pillars} aria-label="Áreas do app">
          <button className={s.pillar} title="Ir para a Carteira">
            <div className={s.pillarHead}>
              <span className={s.pillarTitle}><Briefcase size={13} /> Carteira</span>
              <ArrowRight size={14} className={s.pillarArrow} />
            </div>
            <span className={s.pillarValue}>{fmt(PATRIMONIO)}</span>
            <div className={s.miniAlloc}>
              {ALLOC.map(a => (
                <span key={a.name} className={s.miniAllocSeg} style={{ width: `${a.pct}%`, background: a.color }} title={`${a.name}: ${pct(a.pct)}`} />
              ))}
            </div>
            <span className={s.pillarSub}>22 ativos em 4 classes · saúde <strong>95/100</strong></span>
            <span className={`${s.pillBadge} ${s.pbWarn}`}>▲ 1 comprar · ▼ 3 reduzir</span>
          </button>

          <button className={s.pillar} title="Ir para Finanças">
            <div className={s.pillarHead}>
              <span className={s.pillarTitle}><Wallet size={13} /> Finanças · Julho</span>
              <ArrowRight size={14} className={s.pillarArrow} />
            </div>
            <span className={s.pillarValue} style={{ color: '#34D399' }}>+{fmt(SOBRA_MES)}</span>
            <span className={s.pillarSub}>Entradas <strong>{fmt(CUSTO_MES + SOBRA_MES)}</strong> · Saídas <strong>{fmt(CUSTO_MES)}</strong></span>
            <span className={`${s.pillBadge} ${s.pbWarn}`}>5 contas a pagar · R$ 7.194</span>
          </button>

          <button className={s.pillar} title="Ir para Impostos">
            <div className={s.pillarHead}>
              <span className={s.pillarTitle}><Landmark size={13} /> Impostos</span>
              <ArrowRight size={14} className={s.pillarArrow} />
            </div>
            <span className={s.pillarValue} style={{ color: '#F87171' }}>{fmt(890)}</span>
            <span className={s.pillarSub}>DARF pendente · <strong>R$ 2.340</strong> pagos em 2026</span>
            <span className={`${s.pillBadge} ${s.pbBad}`}>1 atrasado — resolver hoje</span>
          </button>

          <button className={s.pillar} title="Ir para a Estratégia">
            <div className={s.pillarHead}>
              <span className={s.pillarTitle}><Target size={13} /> Estratégia</span>
              <ArrowRight size={14} className={s.pillarArrow} />
            </div>
            <span className={s.pillarValue}>95<span style={{ fontSize: '0.8rem', color: 'var(--color-text-3)' }}> /100</span></span>
            <span className={s.pillarSub}>6 de 11 subclasses fora da tolerância de 2pp</span>
            <span className={`${s.pillBadge} ${s.pbGood}`}>✓ plano definido · 11 metas</span>
          </button>
        </section>

        {/* ── Insights ── */}
        <section className={s.insightsCard} aria-label="Insights automáticos">
          <div className={s.insightsHead}><Lightbulb size={15} /> Insights do mês</div>
          <div className={s.insightRow}>
            <span className={s.insightDot}>◆</span>
            <span>Sua sobra de Julho (<strong>{fmt(SOBRA_MES)}</strong>) cobre <strong>61%</strong> do aporte ideal de rebalanceamento ({fmt(APORTE_IDEAL)}). Aportando-a em Bitcoin, o desvio da carteira cai de 5,2pp para ~2pp.</span>
          </div>
          <div className={s.insightRow}>
            <span className={s.insightDot}>◆</span>
            <span>Seu custo fixo caiu <strong>4,2%</strong> vs a média dos últimos 3 meses — a sobrevivência subiu de 19 para <strong>21 meses</strong>.</span>
          </div>
          <div className={s.insightRow}>
            <span className={s.insightDot}>◆</span>
            <span><strong>IVVB11</strong> é seu melhor ativo do ano (<strong>+22,4%</strong>); <strong>ALTCOINS</strong> é o pior (<strong>−81,9%</strong>) e representa 1,9% da carteira.</span>
          </div>
        </section>

        <p className={s.footNote}>
          Protótipo para avaliação · gráfico com hover e períodos, sync e navegação simulados · nada é persistido
        </p>
      </div>
    </div>
  );
}
