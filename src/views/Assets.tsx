'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { calculatePortfolio, formatCurrency, CHART_COLORS } from '@/lib/calculations';
import AssetModal from '@/components/AssetModal';
import AssetDetailDrawer from '@/components/AssetDetailDrawer';
import PortfolioHistory from '@/components/PortfolioHistory';
import { AssetWithCalcs, Asset } from '@/types';
import styles from './Assets.module.css';
import {
  Plus, BookOpen, RefreshCw, ChevronDown, X, Pencil,
  TrendingUp, TrendingDown, Target, Sparkles, Zap, Wallet,
} from 'lucide-react';
import { useToast } from '@/components/Toast';

type Filter = 'all' | 'buy' | 'sell' | 'ok';
type SortKey = 'posicao' | 'desvio' | 'pl' | 'ticker';

const initials = (ticker: string) => ticker.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

export default function Assets() {
  const {
    activeStrategy, activeAssets, activeStrategyId,
    addAsset, updateAsset, deleteAsset,
    syncPrices, isSyncingPrices, lastPriceSyncAt,
  } = useApp();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [detailAsset, setDetailAsset] = useState<AssetWithCalcs | null>(null);

  const [filter, setFilter] = useState<Filter>('all');
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('posicao');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const summary = useMemo(() => {
    if (!activeStrategy) return null;
    try {
      return calculatePortfolio(activeStrategy, activeAssets);
    } catch {
      return null;
    }
  }, [activeStrategy, activeAssets]);

  const colorFor = (categoryId: string) => {
    const idx = activeStrategy?.categories.findIndex(c => c.id === categoryId) ?? -1;
    return idx >= 0 ? CHART_COLORS[idx % CHART_COLORS.length] : '#6B7280';
  };

  // ── Grupos por subclasse (mesma granularidade da estratégia/meta) ──
  const groups = useMemo(() => {
    if (!summary || !activeStrategy) return [];
    const map = new Map<string, { id: string; subclassName: string; className: string; target: number; color: string; assets: AssetWithCalcs[] }>();
    summary.assetsWithCalcs.filter(a => !a.isArchived).forEach(a => {
      const key = a.category.id;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          subclassName: a.category.subclassName,
          className: a.category.className,
          target: a.category.targetPercent,
          color: colorFor(key),
          assets: [],
        });
      }
      map.get(key)!.assets.push(a);
    });

    const strategyOrder = activeStrategy.categories.map(c => c.id);
    return Array.from(map.values())
      .map(g => {
        const cur = g.assets.reduce((s, a) => s + a.currentValue, 0);
        const p = summary.totalValue > 0 ? (cur / summary.totalValue) * 100 : 0;
        return { ...g, cur, pct: p, dev: p - g.target };
      })
      .sort((a, b) => {
        const ia = strategyOrder.indexOf(a.id), ib = strategyOrder.indexOf(b.id);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, activeStrategy]);

  const outOfTolerance = activeStrategy ? groups.filter(g => Math.abs(g.dev) > activeStrategy.deviationTolerance) : [];

  // Aporte único que recoloca a subclasse mais defasada na meta sem vender
  const worstUnder = useMemo(() => {
    const withTarget = groups.filter(g => g.target > 0);
    if (withTarget.length === 0) return null;
    return [...withTarget].sort((a, b) => a.dev - b.dev)[0];
  }, [groups]);

  const aporteIdeal = useMemo(() => {
    if (!worstUnder || !summary) return 0;
    const target = Math.min(worstUnder.target, 99) / 100;
    return Math.max(0, (target * summary.totalValue - worstUnder.cur) / (1 - target));
  }, [worstUnder, summary]);

  const buys = summary ? summary.assetsWithCalcs.filter(a => !a.isArchived && a.action === 'buy') : [];
  const sells = summary ? summary.assetsWithCalcs.filter(a => !a.isArchived && a.action === 'sell') : [];

  const countBy = (f: Filter) => {
    if (!summary) return 0;
    const active = summary.assetsWithCalcs.filter(a => !a.isArchived);
    return f === 'all' ? active.length : active.filter(a => a.action === f).length;
  };

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter(g => !subFilter || g.id === subFilter)
      .map(g => ({
        ...g,
        assets: g.assets
          .filter(a => filter === 'all' || a.action === filter)
          .filter(a => !q || a.ticker.toLowerCase().includes(q) || (a.info || '').toLowerCase().includes(q))
          .sort((a, b) => {
            switch (sortKey) {
              case 'posicao': return b.currentValue - a.currentValue;
              case 'desvio': return Math.abs(b.rebalanceAmount) - Math.abs(a.rebalanceAmount);
              case 'pl': return (b.investedValue > 0 ? b.currentValue / b.investedValue : 0) - (a.investedValue > 0 ? a.currentValue / a.investedValue : 0);
              case 'ticker': return a.ticker.localeCompare(b.ticker);
            }
          }),
      }))
      .filter(g => g.assets.length > 0);
  }, [groups, filter, subFilter, query, sortKey]);

  const toggleGroup = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const isFiltering = filter !== 'all' || !!subFilter || !!query.trim();

  const handleEdit = (asset: AssetWithCalcs) => {
    setEditingAsset(asset);
    setShowModal(true);
    setDetailAsset(null);
  };

  const handleSave = (data: Omit<Asset, 'id' | 'updatedAt'>) => {
    if (editingAsset) {
      updateAsset(editingAsset.id, data);
      toast(`${data.ticker} atualizado com sucesso`);
    } else {
      addAsset(data);
      toast(`${data.ticker} adicionado à carteira`);
    }
    setEditingAsset(null);
    setShowModal(false);
  };

  const handleArchive = (id: string) => {
    const ticker = activeAssets.find(a => a.id === id)?.ticker ?? 'Ativo';
    updateAsset(id, { isArchived: true });
    toast(`${ticker} encerrado com sucesso`);
    setEditingAsset(null);
    setShowModal(false);
    setDetailAsset(null);
  };

  const lastSyncLabel = () => {
    if (isSyncingPrices) return 'Sincronizando…';
    if (!lastPriceSyncAt) return 'Sincronizar preços';
    const diffMin = Math.round((Date.now() - lastPriceSyncAt.getTime()) / 60000);
    if (diffMin < 1) return 'Preços agora mesmo';
    if (diffMin < 60) return `Preços há ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    return `Preços há ${diffH}h`;
  };

  if (!activeStrategy) {
    return (
      <div className="empty-state">
        <h3>Nenhuma estratégia ativa</h3>
        <p>Vá para a aba Estratégia para configurar sua carteira.</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="empty-state">
        <h3>Não foi possível calcular a carteira</h3>
        <p>Verifique sua estratégia e tente novamente.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Minha Carteira</h1>
          <div className={styles.pageMeta}>
            {activeAssets.length} ativo{activeAssets.length !== 1 ? 's' : ''} · tolerância de {activeStrategy.deviationTolerance}pp
            <button className={styles.syncChip} onClick={() => syncPrices()} disabled={isSyncingPrices} title="Sincronizar cotações agora (Brapi)">
              <RefreshCw size={11} className={isSyncingPrices ? styles.syncSpin : undefined} />
              {lastSyncLabel()}
            </button>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnGhost} onClick={() => setShowHistory(true)} title="Extrato completo de compras e vendas">
            <BookOpen size={15} /> Histórico
          </button>
          <button id="add-asset-btn" className={styles.btnPrimary} onClick={() => { setEditingAsset(null); setShowModal(true); }}>
            <Plus size={16} /> Novo ativo
          </button>
        </div>
      </header>

      {activeAssets.length === 0 ? (
        <div className={styles.emptyState}>
          <Wallet size={48} />
          <h2>Sua carteira está vazia</h2>
          <p style={{ maxWidth: 400, margin: '0.5rem auto 1rem', lineHeight: 1.6 }}>
            Adicione seus ativos para acompanhar a alocação vs sua estratégia e saber quando rebalancear.
          </p>
          <button className={styles.btnPrimary} onClick={() => setShowModal(true)}><Plus size={18} /> Adicionar primeiro ativo</button>
        </div>
      ) : (
        <>
          {/* ── Hero ── */}
          <section className={styles.hero} aria-label="Resumo da carteira">
            <div className={styles.tile}>
              <span className={styles.tileLabel}>Patrimônio investido</span>
              <span className={styles.heroValue}>{formatCurrency(summary.totalValue)}</span>
              <span className={styles.delta}>
                <span className={summary.profitLoss >= 0 ? styles.deltaGood : styles.deltaBad}>
                  {summary.profitLoss >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(summary.profitLoss))} ({pct(Math.abs(summary.totalProfitLossPercent))})
                </span>
                <span className={styles.deltaRef}>sobre {formatCurrency(summary.totalInvested)} aportados</span>
              </span>
              <span className={styles.tileSub}>
                {activeAssets.filter(a => a.priceMode === 'auto').length} de {activeAssets.length} ativos com cotação automática
              </span>
            </div>

            <div className={styles.tile}>
              <span className={styles.tileLabel}>Saúde da estratégia</span>
              <div className={styles.healthRow}>
                <span className={styles.healthScore} style={{ color: summary.healthScore >= 90 ? '#34D399' : summary.healthScore >= 70 ? '#FBBF24' : '#F87171' }}>
                  {Math.round(summary.healthScore)}
                </span>
                <span className={styles.healthOf}>/ 100</span>
              </div>
              <div className={styles.meterTrack} role="img" aria-label={`Saúde da estratégia: ${Math.round(summary.healthScore)} de 100`}>
                <div className={styles.meterFill} style={{ width: `${summary.healthScore}%` }} />
              </div>
              <span className={styles.tileSub}>
                {outOfTolerance.length === 0
                  ? 'Todas as subclasses dentro da tolerância'
                  : `${outOfTolerance.length} de ${groups.length} subclasses fora da tolerância`}
              </span>
            </div>

            <div className={styles.tile}>
              <span className={styles.tileLabel}>Próxima ação sugerida</span>
              {worstUnder && aporteIdeal > 0.01 ? (
                <>
                  <span className={styles.tileValue} style={{ color: 'var(--color-primary-light)' }}>{formatCurrency(aporteIdeal)}</span>
                  <span className={styles.tileSub}>
                    Um aporte único em <strong>{worstUnder.subclassName}</strong> recoloca a carteira dentro da meta — sem vender nada.
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.tileValue} style={{ color: '#34D399' }}>Tudo em ordem</span>
                  <span className={styles.tileSub}>Nenhum rebalanceamento necessário no momento.</span>
                </>
              )}
            </div>
          </section>

          {/* ── Alocação vs meta ── */}
          {groups.length > 0 && (
            <section className={styles.allocCard} aria-label="Alocação atual vs meta">
              <div className={styles.allocHead}>
                <h2 className={styles.allocTitle}><Target size={14} style={{ marginRight: 6 }} />Alocação atual × meta</h2>
                <span className={styles.allocHint}>clique numa classe para filtrar a lista</span>
              </div>

              <div className={styles.allocBar} role="img" aria-label="Distribuição da carteira por subclasse">
                {groups.map(g => (
                  <button key={g.id} className={`${styles.allocSeg} ${subFilter && subFilter !== g.id ? styles.allocSegDim : ''}`}
                    style={{ width: `${g.pct}%`, background: g.color }}
                    onClick={() => setSubFilter(prev => prev === g.id ? null : g.id)}
                    title={`${g.subclassName}: ${pct(g.pct)} (meta ${g.target}%)`}>
                    {g.pct >= 10 ? pct(g.pct) : ''}
                  </button>
                ))}
              </div>

              <div className={styles.allocLegend}>
                {groups.map(g => (
                  <button key={g.id} className={`${styles.legendItem} ${subFilter === g.id ? styles.legendItemActive : ''}`}
                    onClick={() => setSubFilter(prev => prev === g.id ? null : g.id)}>
                    <span className={styles.legendDot} style={{ background: g.color }} />
                    <span className={styles.legendName}>{g.subclassName}</span>
                    <span className={styles.legendNums}>{pct(g.pct)} <span className={styles.legendMeta}>/ meta {g.target}%</span></span>
                    <span className={`${styles.devBadge} ${Math.abs(g.dev) <= activeStrategy.deviationTolerance ? styles.devOk : g.dev > 0 ? styles.devUp : styles.devDown}`}>
                      {Math.abs(g.dev) <= activeStrategy.deviationTolerance ? '✓ na meta' : `${g.dev > 0 ? '▲' : '▼'} ${Math.abs(g.dev).toFixed(1).replace('.', ',')}pp`}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Faixa de rebalanceamento ── */}
          {(buys.length > 0 || sells.length > 0) && (
            <section className={styles.rebalStrip} aria-label="Sugestões de rebalanceamento">
              <Sparkles size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
              <div className={styles.rebalHead}>
                <span className={styles.rebalTitle}>Para voltar à estratégia</span>
                {worstUnder && aporteIdeal > 0.01 && (
                  <span className={styles.rebalSub}>ou aporte {formatCurrency(aporteIdeal)} direto em {worstUnder.subclassName}</span>
                )}
              </div>
              <div className={styles.rebalChips}>
                {buys.map(a => (
                  <button key={a.id} className={styles.rebalChip} onClick={() => setDetailAsset(a)} title={`Ver ${a.ticker}`}>
                    <span className={styles.rebalBuy}>▲ Comprar</span> {a.ticker}
                    <span className={styles.rebalVal}>+{formatCurrency(a.rebalanceAmount)}</span>
                  </button>
                ))}
                {sells.map(a => (
                  <button key={a.id} className={styles.rebalChip} onClick={() => setDetailAsset(a)} title={`Ver ${a.ticker}`}>
                    <span className={styles.rebalSell}>▼ Reduzir</span> {a.ticker}
                    <span className={styles.rebalVal}>−{formatCurrency(Math.abs(a.rebalanceAmount))}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Lista de ativos ── */}
          <section className={styles.card} aria-label="Ativos da carteira">
            <div className={styles.toolbar}>
              <div className={styles.segmented} role="tablist" aria-label="Filtrar por diagnóstico">
                {([
                  { id: 'all' as Filter, label: 'Todos' },
                  { id: 'buy' as Filter, label: '▲ Comprar' },
                  { id: 'sell' as Filter, label: '▼ Reduzir' },
                  { id: 'ok' as Filter, label: '✓ Na meta' },
                ]).map(f => (
                  <button key={f.id} role="tab" aria-selected={filter === f.id}
                    className={`${styles.segBtn} ${filter === f.id ? styles.segActive : ''}`}
                    onClick={() => setFilter(f.id)}>
                    {f.label}<span className={styles.segCount}>{countBy(f.id)}</span>
                  </button>
                ))}
              </div>
              <div className={styles.toolbarRight}>
                <input className={styles.search} placeholder="Buscar ticker ou nome…" value={query}
                  onChange={e => setQuery(e.target.value)} aria-label="Buscar ativo" />
                <select className={styles.sortSelect} value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} aria-label="Ordenar por">
                  <option value="posicao">Maior posição</option>
                  <option value="desvio">Maior desvio</option>
                  <option value="pl">Maior rentabilidade</option>
                  <option value="ticker">A–Z</option>
                </select>
              </div>
            </div>

            {isFiltering && (
              <div className={styles.filterNotice}>
                Mostrando {visibleGroups.reduce((a, g) => a + g.assets.length, 0)} de {activeAssets.length} ativos
                <button className={styles.filterClear} onClick={() => { setFilter('all'); setSubFilter(null); setQuery(''); }}>
                  <X size={11} /> limpar filtros
                </button>
              </div>
            )}

            {visibleGroups.length === 0 && (
              <p className={styles.emptyList}>Nenhum ativo encontrado{query ? ` para "${query}"` : ''}.</p>
            )}

            {visibleGroups.map(g => (
              <div key={g.id} className={styles.group}>
                <button className={styles.groupHead} onClick={() => toggleGroup(g.id)} aria-expanded={!collapsed.has(g.id)}>
                  <ChevronDown size={15} className={`${styles.groupChevron} ${collapsed.has(g.id) ? styles.groupChevronClosed : ''}`} />
                  <span className={styles.legendDot} style={{ background: g.color }} />
                  <span className={styles.groupName}>{g.subclassName}</span>
                  <span className={styles.groupCount}>{g.assets.length} ativo{g.assets.length !== 1 ? 's' : ''}</span>
                  <span className={styles.groupRight}>
                    <span className={styles.groupAlloc}>{pct(g.pct)} / meta {g.target}%</span>
                    <span className={styles.groupTotal}>{formatCurrency(g.cur)}</span>
                  </span>
                </button>

                {!collapsed.has(g.id) && g.assets.map(a => {
                  const aPct = summary.totalValue > 0 ? (a.currentValue / summary.totalValue) * 100 : 0;
                  return (
                    <div key={a.id} className={styles.row} onClick={() => setDetailAsset(a)} role="button" tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter') setDetailAsset(a); }}>
                      <div className={styles.avatar} style={{ background: g.color }} aria-hidden>{initials(a.ticker)}</div>
                      <div className={styles.rowBody}>
                        <div className={styles.rowTicker}>
                          {a.ticker}
                          <span className={`${styles.priceBadge} ${a.priceMode === 'auto' ? styles.priceAuto : styles.priceManual}`}
                            title={a.priceMode === 'auto' ? 'Cotação sincronizada automaticamente (Brapi)' : 'Valor atualizado manualmente por você'}>
                            {a.priceMode === 'auto' ? <><Zap size={9} /> auto</> : 'manual'}
                          </span>
                        </div>
                        <div className={styles.rowInfo}>
                          {a.quantity && a.customPrice ? `${a.quantity} × ${formatCurrency(a.customPrice)}${a.avgPrice ? ` · PM ${formatCurrency(a.avgPrice)}` : ''}` : (a.info || '—')}
                        </div>
                      </div>
                      <div className={styles.rowPos}>
                        <div className={styles.rowPosVal}>{formatCurrency(a.currentValue)}</div>
                        <div className={styles.rowPosPct}>{pct(aPct)} da carteira</div>
                      </div>
                      <div className={styles.rowPL}>
                        <div className={`${styles.plVal} ${a.profitLoss >= 0 ? styles.plGood : styles.plBad}`}>
                          {a.profitLoss >= 0 ? '+' : '−'}{formatCurrency(Math.abs(a.profitLoss))}
                        </div>
                        <div className={`${styles.plPct} ${a.profitLoss >= 0 ? styles.plGood : styles.plBad}`}>
                          {a.profitLoss >= 0 ? '▲' : '▼'} {pct(Math.abs(a.profitLossPercent))}
                        </div>
                      </div>
                      <span className={`${styles.actionBadge} ${a.action === 'buy' ? styles.actBuy : a.action === 'sell' ? styles.actSell : styles.actOk}`}>
                        {a.action === 'buy' ? `▲ Comprar +${formatCurrency(a.rebalanceAmount)}` : a.action === 'sell' ? `▼ Reduzir −${formatCurrency(Math.abs(a.rebalanceAmount))}` : '✓ Na meta'}
                      </span>
                      <div className={styles.rowActions} onClick={e => e.stopPropagation()}>
                        <button className={styles.iconBtn} onClick={() => handleEdit(a)} title="Editar" aria-label={`Editar ${a.ticker}`}><Pencil size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        </>
      )}

      {showModal && (
        <AssetModal
          categories={activeStrategy.categories}
          strategyId={activeStrategyId}
          asset={editingAsset}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingAsset(null); }}
          onArchive={handleArchive}
        />
      )}
      {showHistory && <PortfolioHistory onClose={() => setShowHistory(false)} />}
      {detailAsset && (
        <AssetDetailDrawer
          asset={detailAsset}
          color={colorFor(detailAsset.category.id)}
          onClose={() => setDetailAsset(null)}
          onEdit={() => handleEdit(detailAsset)}
          onArchive={() => handleArchive(detailAsset.id)}
        />
      )}
    </div>
  );
}
