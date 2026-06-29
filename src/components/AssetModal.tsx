'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Asset, StrategyCategory } from '@/types';
import styles from './AssetModal.module.css';
import { X, RefreshCw, Calculator, Landmark, TrendingUp, Archive } from 'lucide-react';
import TickerSearch from './TickerSearch';
import HelpTip from './HelpTip';
import { fetchAssetPrice, detectPriceMode } from '@/lib/brapi';

interface Props {
  categories: StrategyCategory[];
  strategyId: string;
  asset?: Asset | null;
  onSave: (data: Omit<Asset, 'id' | 'updatedAt'>) => void;
  onClose: () => void;
  onArchive?: (id: string) => void; // Encerrar ativo definitivamente
}

const parseNum = (v: string) => parseFloat(v.replace(',', '.'));
const fmtNum = (v: number) => v.toFixed(2).replace('.', ',');

const fmtCurrency = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AssetModal({ categories, strategyId, asset, onSave, onClose, onArchive }: Props) {
  const [ticker, setTicker] = useState('');
  const [info, setInfo] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [selectedClass, setSelectedClass] = useState('');

  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto');

  const [manualInvested, setManualInvested] = useState('');
  const [manualCurrent, setManualCurrent] = useState('');

  const [error, setError] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  const uniqueClasses = Array.from(new Set(categories.map(c => c.className)));

  // ── Modo Renda Fixa ──────────────────────────────────────────────
  const isRendaFixa = selectedClass === 'Renda Fixa';

  // ── Derivados ────────────────────────────────────────────────────
  const qtyNum = parseNum(quantity);
  const avgNum = parseNum(avgPrice);
  const mktNum = parseNum(currentPrice);

  const derivedInvested =
    !isRendaFixa && !isNaN(qtyNum) && qtyNum > 0 && !isNaN(avgNum) && avgNum > 0
      ? qtyNum * avgNum
      : null;

  const derivedCurrent =
    !isRendaFixa && !isNaN(qtyNum) && qtyNum > 0 && !isNaN(mktNum) && mktNum > 0
      ? qtyNum * mktNum
      : null;

  const effectiveInvested = derivedInvested ?? parseNum(manualInvested);
  const effectiveCurrent = derivedCurrent ?? parseNum(manualCurrent);

  // ── Preenche campos ao editar ─────────────────────────────────────
  useEffect(() => {
    if (asset) {
      setTicker(asset.ticker);
      setInfo(asset.info);
      setCategoryId(asset.categoryId);
      const matchedCat = categories.find(c => c.id === asset.categoryId);
      if (matchedCat) setSelectedClass(matchedCat.className);

      if (asset.quantity) setQuantity(asset.quantity.toString().replace('.', ','));
      if (asset.avgPrice) setAvgPrice(fmtNum(asset.avgPrice));
      if (asset.customPrice) setCurrentPrice(fmtNum(asset.customPrice));
      setPriceMode(asset.priceMode ?? detectPriceMode(asset.ticker));

      if (!asset.avgPrice || !asset.quantity) setManualInvested(fmtNum(asset.investedValue));
      if (!asset.customPrice || !asset.quantity) setManualCurrent(fmtNum(asset.currentValue));
    } else if (categories.length > 0) {
      const initialClass = uniqueClasses[0] ?? '';
      setSelectedClass(initialClass);
      const initialSubs = categories.filter(c => c.className === initialClass);
      if (initialSubs.length > 0) setCategoryId(initialSubs[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, categories]);

  useEffect(() => {
    if (!asset && ticker) setPriceMode(detectPriceMode(ticker));
  }, [ticker, asset]);

  // ── Auto-foco no campo Valor Atual ao abrir para edição ──────────────
  const currentInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!asset) return; // só em modo edição
    // Delay para aguardar o estado do formulário ser preenchido e o modal renderizado
    const timer = setTimeout(() => {
      if (currentInputRef.current) {
        currentInputRef.current.focus();
        currentInputRef.current.select();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [asset]);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClass = e.target.value;
    setSelectedClass(newClass);
    const subs = categories.filter(c => c.className === newClass);
    setCategoryId(subs.length > 0 ? subs[0].id : '');
  };

  const filteredSubclasses = categories.filter(c => c.className === selectedClass);

  // ── Busca cotação ─────────────────────────────────────────────────
  const handleFetchPrice = useCallback(async () => {
    if (!ticker) return;
    setIsFetchingPrice(true);
    setError('');
    const fetched = await fetchAssetPrice(ticker);
    setIsFetchingPrice(false);
    if (fetched !== null) {
      setCurrentPrice(fmtNum(fetched));
    } else {
      setError('Não foi possível obter a cotação. Insira o preço manualmente.');
    }
  }, [ticker]);

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const qty = quantity ? parseNum(quantity) : undefined;
    const avg = avgPrice ? parseNum(avgPrice) : undefined;
    const mkt = currentPrice ? parseNum(currentPrice) : undefined;

    const invested = effectiveInvested;
    const current = effectiveCurrent;

    if (!ticker.trim()) return setError('Informe o ticker ou nome do ativo.');
    if (!categoryId) return setError('Selecione a subclasse.');
    if (isNaN(invested) || invested < 0) return setError('Informe o valor investido.');
    if (isNaN(current) || current < 0) return setError('Informe o valor atual.');

    onSave({
      strategyId,
      categoryId,
      ticker: ticker.trim().toUpperCase(),
      info: info.trim(),
      investedValue: invested,
      currentValue: current,
      quantity: qty !== undefined && !isNaN(qty) ? qty : undefined,
      avgPrice: avg !== undefined && !isNaN(avg) ? avg : undefined,
      customPrice: mkt !== undefined && !isNaN(mkt) ? mkt : undefined,
      priceMode: isRendaFixa ? 'manual' : priceMode,
    });
    onClose();
  };

  const hasQty = !isNaN(qtyNum) && qtyNum > 0;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${styles.modalWrap}`}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <div className={`${styles.headerIcon} ${isRendaFixa ? styles.headerIconRF : ''}`}>
              {isRendaFixa ? <Landmark size={15} /> : <TrendingUp size={15} />}
            </div>
            <div>
              <h2>{asset ? 'Editar Ativo' : 'Adicionar Ativo'}</h2>
              {isRendaFixa && (
                <span className={styles.modeBadge}>Renda Fixa</span>
              )}
            </div>
          </div>
          <button id="close-asset-modal" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ── Identidade ── */}
          <div className={styles.fieldRow}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label">Ticker / Nome *</label>
              <TickerSearch
                value={ticker}
                onChange={(t, name) => {
                  setTicker(t);
                  if (name && !info.trim()) setInfo(name);
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label" htmlFor="asset-info">Descrição</label>
            <input
              id="asset-info"
              className="input"
              placeholder={isRendaFixa ? 'Ex: CDB Banco XP, LCI Itaú' : 'Ex: BlackRock, Banco do Brasil'}
              value={info}
              onChange={e => setInfo(e.target.value)}
            />
          </div>

          {/* ── Classe / Subclasse ── */}
          <div className={styles.twoCol}>
            <div className="form-group">
              <label className="label" htmlFor="asset-class">Classe *</label>
              <select
                id="asset-class"
                className={`input ${styles.selectInput}`}
                value={selectedClass}
                onChange={handleClassChange}
              >
                {uniqueClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="asset-category">Subclasse *</label>
              <select
                id="asset-category"
                className={`input ${styles.selectInput}`}
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                {asset && !categories.some(c => c.id === categoryId) && (
                  <option value={categoryId} disabled>(Categoria Órfã)</option>
                )}
                {filteredSubclasses.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.subclassName} ({cat.targetPercent.toFixed(1)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              MODO RENDA FIXA — apenas investido + atual
          ══════════════════════════════════════════════ */}
          {isRendaFixa ? (
            <>
              <div className={styles.sectionDivider}>
                <span>Valores</span>
              </div>

              <div className={styles.twoCol}>
                <div className="form-group">
                  <label className="label" htmlFor="asset-invested-rf">Valor Investido (R$) *</label>
                  <input
                    id="asset-invested-rf"
                    className="input"
                    placeholder="0,00"
                    value={manualInvested}
                    onChange={e => setManualInvested(e.target.value)}
                    autoComplete="off"
                    inputMode="decimal"
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="asset-current-rf">Valor Atual (R$) *</label>
                  <input
                    ref={currentInputRef}
                    id="asset-current-rf"
                    className="input"
                    placeholder="0,00"
                    value={manualCurrent}
                    onChange={e => setManualCurrent(e.target.value)}
                    autoComplete="off"
                    inputMode="decimal"
                  />
                </div>
              </div>
            </>
          ) : (
          /* ══════════════════════════════════════════════
              MODO RENDA VARIÁVEL / CRYPTO — completo
          ══════════════════════════════════════════════ */
            <>
              {/* ── Seção Posição ── */}
              <div className={styles.sectionDivider}>
                <span>Posição</span>
              </div>

              <div className={styles.twoCol}>
                <div className="form-group">
                  <label className="label" htmlFor="asset-qty">Quantidade</label>
                  <input
                    id="asset-qty"
                    className="input"
                    placeholder="Ex: 100"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    autoComplete="off"
                    inputMode="decimal"
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="asset-avgprice">
                    Preço Médio
                    <HelpTip text="Quanto você pagou em média por cada ação ou cota. É o custo total de aquisição dividido pela quantidade." />
                    <span className={styles.labelHint}>por ação</span>
                  </label>
                  <input
                    id="asset-avgprice"
                    className="input"
                    placeholder="0,00"
                    value={avgPrice}
                    onChange={e => setAvgPrice(e.target.value)}
                    autoComplete="off"
                    inputMode="decimal"
                  />
                </div>
              </div>

              {/* Custo total — resultado derivado ou manual */}
              {derivedInvested !== null ? (
                <div className={styles.resultCard}>
                  <span className={styles.resultLabel}>
                    <Calculator size={11} />
                    Custo total
                  </span>
                  <span className={styles.resultValue}>{fmtCurrency(derivedInvested)}</span>
                </div>
              ) : (
                <div className="form-group">
                  <label className="label" htmlFor="asset-invested">Custo Total (R$) * <HelpTip text="Soma de tudo que você investiu neste ativo. Se preencher Quantidade e Preço Médio, será calculado automaticamente." /></label>
                  <input
                    id="asset-invested"
                    className="input"
                    placeholder={hasQty ? 'Preenchido pelo PME acima' : '0,00'}
                    value={manualInvested}
                    onChange={e => setManualInvested(e.target.value)}
                    autoComplete="off"
                    inputMode="decimal"
                  />
                </div>
              )}

              {/* ── Seção Cotação com pill Auto/Manual ── */}
              <div className={styles.sectionDividerWithControl}>
                <span className={styles.sectionDividerText}>Cotação atual</span>
                <div className={styles.modePill}>
                  <button
                    type="button"
                    className={`${styles.pillBtn} ${priceMode === 'auto' ? styles.pillBtnActive : ''}`}
                    onClick={() => setPriceMode('auto')}
                    title="Preço atualizado automaticamente pela Brapi"
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className={`${styles.pillBtn} ${priceMode === 'manual' ? styles.pillBtnActive : ''}`}
                    onClick={() => setPriceMode('manual')}
                    title="Preço inserido manualmente"
                  >
                    Manual
                  </button>
                </div>
              </div>

              <div className={styles.twoCol}>
                <div className="form-group">
                  <label className="label" htmlFor="asset-price">
                    Preço de Mercado
                    <HelpTip text="Cotação atual do ativo na bolsa. No modo Auto, é atualizado pela Brapi. No modo Manual, você insere o valor." />
                    {priceMode === 'auto' && (
                      <button
                        type="button"
                        onClick={handleFetchPrice}
                        disabled={isFetchingPrice || !ticker}
                        className={styles.refreshBtn}
                        title="Buscar cotação agora"
                      >
                        <RefreshCw size={11} className={isFetchingPrice ? styles.spin : ''} />
                        {isFetchingPrice ? 'Buscando…' : 'Atualizar'}
                      </button>
                    )}
                  </label>
                  <input
                    id="asset-price"
                    className="input"
                    placeholder={priceMode === 'auto' ? 'Atualizado automaticamente' : '0,00'}
                    value={currentPrice}
                    onChange={e => { if (priceMode === 'manual') setCurrentPrice(e.target.value); }}
                    readOnly={priceMode === 'auto'}
                    style={priceMode === 'auto' ? { cursor: 'default', opacity: 0.6 } : {}}
                    autoComplete="off"
                    inputMode="decimal"
                  />
                </div>

                {/* Valor atual — resultado derivado ou manual */}
                {derivedCurrent !== null ? (
                  <div className={styles.resultCardCol}>
                    <span className={styles.resultLabel}>
                      <Calculator size={11} />
                      Valor atual
                    </span>
                    <span className={styles.resultValue}>{fmtCurrency(derivedCurrent)}</span>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="label" htmlFor="asset-current">Valor Atual (R$) * <HelpTip text="Valor de mercado total deste ativo hoje. Se preencher Quantidade e Preço de Mercado, será calculado automaticamente." /></label>
                    <input
                      ref={currentInputRef}
                      id="asset-current"
                      className="input"
                      placeholder="0,00"
                      value={manualCurrent}
                      onChange={e => setManualCurrent(e.target.value)}
                      autoComplete="off"
                      inputMode="decimal"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.footer}>
            {/* Botão Encerrar Ativo — só aparece ao editar um ativo existente */}
            {asset && onArchive && (
              <button
                type="button"
                className={`btn ${styles.archiveBtn}`}
                onClick={() => {
                  if (confirm(
                    `Encerrar "${asset.ticker}"?\n\n` +
                    '• O ativo será removido da estratégia e dos cálculos\n' +
                    '• O histórico de transações e impostos será preservado\n' +
                    '• Essa ação pode ser desfeita pelo suporte'
                  )) {
                    onArchive(asset.id);
                    onClose();
                  }
                }}
                title="Encerrar ativo definitivamente"
              >
                <Archive size={14} />
                Encerrar Ativo
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" id="cancel-asset-modal" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" id="save-asset-btn" className="btn btn-primary">
              {asset ? 'Salvar alterações' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
