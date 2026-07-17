'use client';

import React, { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Eye, X } from 'lucide-react';
import { read, utils } from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { AssetType } from '@/types';
import styles from '@/views/Profile.module.css';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface ParsedRow {
  ticker: string;
  assetId: string | null; // null = ativo será criado automaticamente na importação
  isNewAsset: boolean;
  type: 'buy' | 'sell';
  value: number;
  quantity: number;
  price: number;
  isoDate: string;
  dateDay: string; // YYYY-MM-DD
  duplicate: boolean; // detectado antes de inserir
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseB3Date(raw: unknown): { isoDate: string; dateDay: string } {
  // Célula de data nativa do Excel (com cellDates: true)
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const dateDay = `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
    return { isoDate: `${dateDay}T12:00:00Z`, dateDay };
  }
  // Número serial do Excel (dias desde 30/12/1899)
  if (typeof raw === 'number' && raw > 25569) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    const dateDay = d.toISOString().split('T')[0];
    return { isoDate: `${dateDay}T12:00:00Z`, dateDay };
  }
  // Texto dd/mm/aaaa
  const parts = String(raw ?? '').trim().split('/');
  if (parts.length === 3) {
    const dateDay = `${parts[2].padStart(4, '20')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    return { isoDate: `${dateDay}T12:00:00Z`, dateDay };
  }
  const now = new Date();
  return {
    isoDate: now.toISOString(),
    dateDay: now.toISOString().split('T')[0],
  };
}

function parseNum(raw: unknown): number {
  // Célula numérica nativa do Excel — usar direto, sem manipular string
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  let s = String(raw ?? '0').replace(/[R$\s ]/g, '');
  if (s.includes(',')) {
    // Formato brasileiro: "1.234,56" → ponto é separador de milhar
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Normaliza célula de cabeçalho: remove espaços extras/NBSP e baixa a caixa. */
function normHeader(h: unknown): string {
  return String(h ?? '').replace(/ /g, ' ').trim().toLowerCase();
}

/**
 * Calcula o custo base pelo Preço Médio de Aquisição (PME).
 * investedValue = custo total atual do ativo ANTES da venda.
 * quantity = quantidade total ANTES da venda.
 * soldQty = cotas vendidas.
 */
function calcPME(investedValue: number, totalQty: number, soldQty: number): number {
  if (!totalQty || !soldQty) return 0;
  const avgPrice = investedValue / totalQty;
  return parseFloat((avgPrice * soldQty).toFixed(2));
}

/**
 * Verifica se uma transação já existe no Supabase para este ativo neste dia
 * com este valor e tipo — antes de inserir.
 */
async function isDuplicate(
  userId: string,
  assetId: string,
  dateDay: string,
  value: number,
  type: 'buy' | 'sell',
): Promise<boolean> {
  const { data } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('asset_id', assetId)
    .eq('type', type)
    .eq('value', value)
    .eq('date_day', dateDay)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function B3ImportSection() {
  const { assets, addAsset, updateAsset, addCategory, activeStrategy, activeStrategyId, addTransaction, addSellTaxRecord } = useApp();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string } | null>(null);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  const parseFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    setStatus({ type: 'info', message: 'Analisando arquivo...' });
    setPreview(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data, { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = utils.sheet_to_json<any[]>(sheet, { header: 1 });

      if (rows.length < 2) throw new Error('Arquivo vazio ou formato inválido.');

      const headerRow = rows.find(
        r =>
          Array.isArray(r) &&
          r.length > 3 &&
          r.some(c => {
            const h = normHeader(c);
            return h === 'produto' || h === 'código de negociação' || h === 'codigo de negociação' || h === 'código de negociacão';
          })
      );
      if (!headerRow) throw new Error('Cabeçalho não encontrado. Use o arquivo de Negociação ou Movimentação exportado pela Área do Investidor (B3), sem editar as colunas.');

      const findCol = (...names: string[]) => headerRow.findIndex((h: unknown) => names.includes(normHeader(h)));
      const idx = {
        produto: findCol('produto', 'código de negociação', 'codigo de negociação'),
        data: findCol('data', 'data do negócio', 'data do negocio'),
        mov: findCol('movimentação', 'movimentacao', 'tipo de movimentação', 'tipo de movimentacao'),
        qtd: findCol('quantidade'),
        preco: findCol('preço unitário', 'preco unitário', 'preço', 'preco'),
        total: findCol('valor da operação', 'valor da operacao', 'valor'),
        entradaSaida: findCol('entrada/saída', 'entrada/saida') !== -1 ? findCol('entrada/saída', 'entrada/saida') : 0,
      };

      if (idx.produto === -1 || idx.data === -1) throw new Error('Colunas obrigatórias ausentes no arquivo.');

      const parsed: ParsedRow[] = [];
      const headerIdx = rows.indexOf(headerRow);
      const unmatchedTickers = new Set<string>();

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[idx.produto]) continue;

        // Extrair ticker: remove sufixo 'F' de fracionário para casar com ativo cadastrado
        const rawCode = String(row[idx.produto]).split(' - ')[0].trim().toUpperCase();
        const ticker = /^[A-Z]{4}\d{1,2}F$/.test(rawCode) ? rawCode.slice(0, -1) : rawCode;

        // Tipo de movimento
        const rawMov = String(row[idx.mov] ?? '').toLowerCase();
        let txType: 'buy' | 'sell' | null = null;
        if (rawMov.includes('compra')) txType = 'buy';
        else if (rawMov.includes('venda')) txType = 'sell';
        // Movimentação: "Transferência - Liquidação" Credito = compra, Debito = venda
        else if (rawMov.includes('transferência - liquidação') || rawMov.includes('transferencia - liquidacao')) {
          const direction = String(row[idx.entradaSaida]).toLowerCase();
          txType = direction.startsWith('cred') ? 'buy' : 'sell';
        }

        if (!txType) continue; // ignora dividendos, atualizações, etc.

        // Casar com ativo cadastrado (aceita PETR4 e PETR4F → PETR4);
        // ativos não cadastrados serão criados automaticamente na importação
        const asset = assets.find(a => {
          const t = a.ticker.toUpperCase().trim();
          return t === ticker || t === rawCode;
        });
        if (!asset) unmatchedTickers.add(ticker);

        const { isoDate, dateDay } = parseB3Date(row[idx.data]);
        const quantity = parseNum(row[idx.qtd]);
        const price = parseNum(row[idx.preco]);
        const value = parseNum(row[idx.total]);

        if (!value || value <= 0) continue;

        // Verificar duplicata no Supabase antes do preview (só possível para ativos existentes)
        const dup = asset ? await isDuplicate(user.id, asset.id, dateDay, value, txType) : false;

        parsed.push({
          ticker: asset?.ticker ?? ticker,
          assetId: asset?.id ?? null,
          isNewAsset: !asset,
          type: txType,
          value,
          quantity,
          price,
          isoDate,
          dateDay,
          duplicate: dup,
        });
      }

      if (parsed.length === 0) {
        setStatus({
          type: 'warning',
          message: 'Nenhuma transação de compra/venda foi reconhecida no arquivo. Verifique se você exportou o extrato de Negociação (ou Movimentação) da Área do Investidor da B3 — extratos de proventos/dividendos não contêm compras e vendas.',
        });
        setLoading(false);
        return;
      }

      const dups = parsed.filter(r => r.duplicate).length;
      const newCount = unmatchedTickers.size;
      const newNote = newCount > 0
        ? ` 🆕 ${newCount} ativo(s) novo(s) serão criados automaticamente: ${Array.from(unmatchedTickers).sort().join(', ')}.`
        : '';
      setPreview(parsed);
      setStatus({
        type: dups > 0 ? 'warning' : 'info',
        message: `${parsed.length} transação(ões) encontrada(s). ${dups > 0 ? `⚠️ ${dups} já existem e serão ignoradas.` : 'Nenhuma duplicata detectada.'}${newNote} Revise e confirme.`,
      });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Erro ao processar arquivo.' });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    if (!preview || !user) return;
    setConfirming(true);

    let importedCount = 0;
    let skippedCount = 0;
    let createdCount = 0;

    // Agrupar por ticker para reproduzir o histórico de cada ativo em ordem cronológica
    const byTicker = new Map<string, ParsedRow[]>();
    for (const row of preview) {
      if (row.duplicate) { skippedCount++; continue; }
      const list = byTicker.get(row.ticker) ?? [];
      list.push(row);
      byTicker.set(row.ticker, list);
    }

    // Categoria padrão para ativos criados automaticamente (criada uma única vez)
    let importCategoryId: string | null = null;
    const ensureImportCategory = (): string => {
      if (importCategoryId) return importCategoryId;
      const existing = activeStrategy?.categories.find(c => c.subclassName === 'Importado da B3');
      importCategoryId = existing?.id
        ?? addCategory({ className: 'Renda Variável', subclassName: 'Importado da B3', targetPercent: 0 }).id;
      return importCategoryId;
    };

    for (const [ticker, rows] of Array.from(byTicker.entries())) {
      // Ordem cronológica; no mesmo dia, compras antes de vendas (garante custo antes da baixa)
      rows.sort((a: ParsedRow, b: ParsedRow) =>
        a.dateDay === b.dateDay
          ? (a.type === b.type ? 0 : a.type === 'buy' ? -1 : 1)
          : a.dateDay.localeCompare(b.dateDay)
      );

      // Ativo existente na carteira, ou criado automaticamente agora
      let asset = rows[0].assetId ? assets.find(a => a.id === rows[0].assetId) : undefined;
      if (!asset) {
        asset = addAsset(
          {
            strategyId: activeStrategyId,
            categoryId: ensureImportCategory(),
            ticker,
            info: 'Importado da B3',
            investedValue: 0,
            currentValue: 0,
            quantity: 0,
            priceMode: 'auto',
          },
          { skipInitialTransaction: true },
        );
        createdCount++;
      }

      // Replay cronológico com PME sobre a posição corrente do ativo
      let qty = asset.quantity ?? 0;
      let invested = asset.investedValue;
      let current = asset.currentValue;

      for (const row of rows) {
        addTransaction({
          assetId: asset.id,
          type: row.type,
          value: row.value,
          quantity: row.quantity,
          unitPrice: row.price,
          date: row.isoDate,
          notes: `Importado da B3 — Qtd: ${row.quantity} | Preço Unit: R$ ${row.price.toFixed(2)}`,
        });

        if (row.type === 'buy') {
          qty += row.quantity;
          invested += row.value;
          current += row.value;
        } else {
          // Venda: custo pela posição acumulada até aqui (PME)
          const hasCost = qty > 0 && invested > 0;
          const costBasis = hasCost ? calcPME(invested, qty, Math.min(row.quantity, qty)) : 0;
          const profitLoss = parseFloat((row.value - costBasis).toFixed(2));
          const isLoss = profitLoss < 0;
          const assetType: AssetType = ticker.endsWith('11') || ticker.endsWith('12') ? 'fii' : 'acao';

          addSellTaxRecord({
            assetId: asset.id,
            assetTicker: ticker,
            sellValue: row.value,
            costBasis,
            profitLoss,
            assetType,
            taxRate: assetType === 'fii' ? 0.2 : 0.15,
            taxDue: 0,
            isExempt: !isLoss && row.value <= 20000,
            exemptReason: !isLoss && row.value <= 20000 ? 'Venda de ações (comum) abaixo de 20 mil reais no mês' : undefined,
            isLoss,
            lossUsedForCompensation: 0,
            taxPaid: false,
            notes: hasCost
              ? `Importado da B3 — Custo via PME (R$ ${(costBasis / (row.quantity || 1)).toFixed(2)}/cota × ${row.quantity} cotas)`
              : `Importado da B3 — ⚠️ Custo de aquisição não identificado no extrato (compra anterior ao período exportado). Edite o registro para informar o custo correto.`,
            sellDate: row.dateDay,
          });

          qty = Math.max(0, qty - row.quantity);
          invested = Math.max(0, parseFloat((invested - costBasis).toFixed(2)));
          current = Math.max(0, parseFloat((current - row.value).toFixed(2)));
        }

        importedCount++;
      }

      // Consolidar posição final do ativo (cotação de mercado atualiza na próxima sincronização)
      updateAsset(asset.id, {
        quantity: qty,
        investedValue: parseFloat(invested.toFixed(2)),
        currentValue: parseFloat(current.toFixed(2)),
        avgPrice: qty > 0 ? parseFloat((invested / qty).toFixed(2)) : 0,
      });
    }

    setPreview(null);
    setConfirming(false);
    setStatus({
      type: 'success',
      message: `✅ ${importedCount} transações importadas com sucesso!${createdCount > 0 ? ` ${createdCount} ativo(s) criado(s) automaticamente na categoria "Importado da B3" — você pode recategorizá-los depois na aba Carteira.` : ''}${skippedCount > 0 ? ` ${skippedCount} duplicatas ignoradas.` : ''}`,
    });
  };

  return (
    <div className={styles.formSection} style={{ marginTop: '2rem', borderTop: '1px solid #334155', paddingTop: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <FileSpreadsheet color="#3B82F6" />
        <h3 style={{ margin: 0 }}>Importação Inteligente da B3</h3>
      </div>

      <p className={styles.helpText} style={{ marginBottom: '1.5rem', display: 'block' }}>
        Importe compras e vendas diretamente do arquivo oficial da B3. Duplicatas são detectadas automaticamente e o custo de IR é calculado pelo PME.
      </p>

      <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <h4 style={{ fontSize: '0.9rem', color: '#60A5FA', marginTop: 0, marginBottom: '0.5rem' }}>Como exportar seus dados:</h4>
        <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#94A3B8', fontSize: '0.85rem', lineHeight: '1.6' }}>
          <li>Acesse a <strong>Área do Investidor (B3)</strong> em portal.b3.com.br</li>
          <li>Vá em <strong>Extratos e Informativos &gt; Negociação</strong> (ou Movimentação)</li>
          <li>Filtre o período desejado e clique em <strong>Exportar para Excel</strong></li>
          <li>Faça o upload do arquivo gerado aqui. O sistema mostrará um <strong>preview</strong> antes de salvar.</li>
        </ol>
      </div>

      {/* Botão de upload */}
      {!preview && (
        <div className={styles.buttonGroup}>
          <button
            className={styles.secondaryBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            style={{ borderColor: '#3B82F6', color: '#3B82F6', background: 'rgba(59, 130, 246, 0.1)' }}
          >
            {loading ? <span>Analisando...</span> : <><Upload size={18} /><span>Selecionar Arquivo Excel</span></>}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={parseFile} />
        </div>
      )}

      {/* Preview das transações detectadas */}
      {preview && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60A5FA', fontWeight: 600 }}>
              <Eye size={16} />
              <span>Preview — {preview.length} transação(ões) detectada(s)</span>
            </div>
            <button onClick={() => { setPreview(null); setStatus(null); }} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ maxHeight: '280px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #1E293B' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#1E293B', color: '#94A3B8' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Ativo</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tipo</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qtd</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Valor</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Data</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #1E293B', opacity: row.duplicate ? 0.45 : 1 }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.ticker}</td>
                    <td style={{ padding: '8px 12px', color: row.type === 'buy' ? '#34D399' : '#F87171' }}>
                      {row.type === 'buy' ? '↑ Compra' : '↓ Venda'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.quantity}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      {row.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#94A3B8' }}>{row.dateDay}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {row.duplicate
                        ? <span style={{ color: '#F59E0B', fontSize: '0.75rem' }}>⚠ Duplicata</span>
                        : row.isNewAsset
                        ? <span style={{ color: '#60A5FA', fontSize: '0.75rem' }}>🆕 Novo ativo</span>
                        : <span style={{ color: '#34D399', fontSize: '0.75rem' }}>✓ Novo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.buttonGroup} style={{ marginTop: '1rem' }}>
            <button
              className={styles.secondaryBtn}
              onClick={() => { setPreview(null); setStatus(null); }}
              style={{ borderColor: '#475569', color: '#94A3B8' }}
            >
              Cancelar
            </button>
            <button
              className={styles.secondaryBtn}
              onClick={confirmImport}
              disabled={confirming || preview.every(r => r.duplicate)}
              style={{ borderColor: '#22C55E', color: '#22C55E', background: 'rgba(34,197,94,0.1)' }}
            >
              {confirming ? 'Importando...' : `Confirmar e Importar (${preview.filter(r => !r.duplicate).length} novo(s))`}
            </button>
          </div>
        </div>
      )}

      {/* Status feedback */}
      {status && (
        <div style={{
          marginTop: '1rem',
          padding: '12px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          background: status.type === 'success' ? 'rgba(16,185,129,0.1)' : status.type === 'error' ? 'rgba(239,68,68,0.1)' : status.type === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
          color: status.type === 'success' ? '#34D399' : status.type === 'error' ? '#F87171' : status.type === 'warning' ? '#FBBF24' : '#60A5FA',
          border: `1px solid ${status.type === 'success' ? 'rgba(16,185,129,0.2)' : status.type === 'error' ? 'rgba(239,68,68,0.2)' : status.type === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)'}`,
          fontSize: '0.875rem',
        }}>
          {status.type === 'success' ? <CheckCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} /> : <AlertTriangle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />}
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
}
