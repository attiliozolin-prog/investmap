'use client';

import { useState } from 'react';
import { AssetWithCalcs } from '@/types';
import { formatCurrency } from '@/lib/calculations';
import styles from '@/views/Assets.module.css';
import { X, TrendingUp, TrendingDown, Pencil, History, Archive, Zap } from 'lucide-react';
import TransactionModal from './TransactionModal';
import AssetHistoryDrawer from './AssetHistoryDrawer';

interface Props {
  asset: AssetWithCalcs;
  color: string;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

const initials = (ticker: string) => ticker.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();

/**
 * Painel de detalhe do ativo — abre a partir do clique na linha da lista.
 * Concentra a "hero" do ativo (posição, P/L, meta vs atual) e delega as
 * ações pesadas (aporte/venda com cálculo de IR, edição, histórico
 * completo) para os modais já existentes no app.
 */
export default function AssetDetailDrawer({ asset, color, onClose, onEdit, onArchive }: Props) {
  const [txType, setTxType] = useState<'buy' | 'sell' | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const pl = asset.profitLoss;
  const plPct = asset.profitLossPercent;
  const dev = asset.diffPercent;

  // Escala a barra até 1,6× a meta (ou 100%) para o marcador de meta nunca
  // ficar colado na borda — mesmo critério do protótipo aprovado.
  const scaleMax = Math.max(asset.assetTargetPercent * 1.6, asset.currentPortfolioPercent, 1);
  const fillPct = Math.min(100, (asset.currentPortfolioPercent / scaleMax) * 100);
  const targetPct = Math.min(100, (asset.assetTargetPercent / scaleMax) * 100);

  return (
    <>
      <div className={styles.drawerOverlay} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Detalhes de ${asset.ticker}`}>
        <div className={styles.drawerHead}>
          <div className={styles.avatar} style={{ background: color }} aria-hidden>{initials(asset.ticker)}</div>
          <div className={styles.drawerTitle}>
            <h2 className={styles.drawerTicker}>{asset.ticker}</h2>
            <span className={styles.drawerInfo}>{asset.info || asset.category.subclassName} · {asset.category.subclassName}</span>
          </div>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Fechar"><X size={15} /></button>
        </div>

        <div className={styles.drawerBody}>
          <div className={styles.drawerHero}>
            <span className={styles.tileLabel}>Posição atual</span>
            <span className={styles.drawerPos}>{formatCurrency(asset.currentValue)}</span>
            <span className={styles.delta}>
              <span className={pl >= 0 ? styles.deltaGood : styles.deltaBad}>
                {pl >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(pl))} ({Math.abs(plPct).toFixed(1).replace('.', ',')}%)
              </span>
              <span className={styles.deltaRef}>desde o início</span>
            </span>
          </div>

          <div className={styles.statGrid}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Investido</div>
              <div className={styles.statVal}>{formatCurrency(asset.investedValue)}</div>
            </div>
            {asset.quantity ? (
              <>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Quantidade</div>
                  <div className={styles.statVal}>{asset.quantity}</div>
                </div>
                {asset.avgPrice != null && (
                  <div className={styles.stat}>
                    <div className={styles.statLabel}>Preço médio</div>
                    <div className={styles.statVal}>{formatCurrency(asset.avgPrice)}</div>
                  </div>
                )}
                {asset.customPrice != null && (
                  <div className={styles.stat}>
                    <div className={styles.statLabel}>Cotação atual</div>
                    <div className={styles.statVal} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {formatCurrency(asset.customPrice)}
                      {asset.priceMode === 'auto' && <Zap size={11} color="#34D399" />}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.stat}>
                <div className={styles.statLabel}>Atualização</div>
                <div className={styles.statVal}>{asset.priceMode === 'auto' ? 'automática' : 'manual'}</div>
              </div>
            )}
          </div>

          <div>
            <div className={styles.drawerAllocRow}>
              <span>{asset.currentPortfolioPercent.toFixed(1).replace('.', ',')}% da carteira</span>
              <span>meta individual {asset.assetTargetPercent.toFixed(1).replace('.', ',')}%</span>
            </div>
            <div className={styles.drawerBarTrack}>
              <div className={styles.drawerBarFill} style={{ width: `${fillPct}%`, background: color }} />
              <div className={styles.drawerBarTarget} style={{ left: `${targetPct}%` }} title={`Meta: ${asset.assetTargetPercent.toFixed(1)}%`} />
            </div>
          </div>

          {asset.action !== 'ok' && (
            <div className={styles.rebalStrip} style={{ borderLeftColor: asset.action === 'buy' ? '#D97706' : '#EF4444' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-2)' }}>
                {asset.action === 'buy'
                  ? <>Sugestão: <strong className={styles.rebalBuy}>comprar +{formatCurrency(asset.rebalanceAmount)}</strong> para atingir a meta (desvio {dev.toFixed(1).replace('.', ',')}pp)</>
                  : <>Sugestão: <strong className={styles.rebalSell}>reduzir −{formatCurrency(Math.abs(asset.rebalanceAmount))}</strong> para voltar à meta (desvio {dev.toFixed(1).replace('.', ',')}pp)</>}
              </span>
            </div>
          )}

          <div className={styles.drawerActions}>
            <button className={`${styles.actionBtn} ${styles.actionBuy}`} onClick={() => setTxType('buy')}>
              <TrendingUp size={15} /> Aporte
            </button>
            <button className={`${styles.actionBtn} ${styles.actionSell}`} onClick={() => setTxType('sell')}>
              <TrendingDown size={15} /> Venda
            </button>
            <button className={styles.actionBtn} onClick={onEdit}><Pencil size={15} /> Editar</button>
            <button className={styles.actionBtn} onClick={() => setShowHistory(true)}><History size={15} /> Histórico</button>
          </div>

          <button className={styles.archiveLink} onClick={onArchive}>
            <Archive size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
            Encerrar ativo (vendido por completo)
          </button>
        </div>
      </aside>

      {txType && (
        <TransactionModal assetId={asset.id} initialType={txType} onClose={() => setTxType(null)} />
      )}
      {showHistory && (
        <AssetHistoryDrawer assetId={asset.id} onClose={() => setShowHistory(false)} />
      )}
    </>
  );
}
