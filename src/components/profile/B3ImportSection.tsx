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
  assetId: string;
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
  const { assets, addTransaction, addSellTaxRecord, transactions } = useApp();
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
      let recognizedCount = 0;

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
        recognizedCount++;

        // Casar com ativo cadastrado (aceita PETR4 e PETR4F → PETR4)
        const asset = assets.find(a => {
          const t = a.ticker.toUpperCase().trim();
          return t === ticker || t === rawCode;
        });
        if (!asset) {
          unmatchedTickers.add(ticker);
          continue;
        }

        const { isoDate, dateDay } = parseB3Date(String(row[idx.data]));
        const quantity = parseNum(row[idx.qtd]);
        const price = parseNum(row[idx.preco]);
        const value = parseNum(row[idx.total]);

        if (!value || value <= 0) continue;

        // Verificar duplicata no Supabase antes do preview
        const dup = await isDuplicate(user.id, asset.id, dateDay, value, txType);

        parsed.push({ ticker: asset.ticker, assetId: asset.id, type: txType, value, quantity, price, isoDate, dateDay, duplicate: dup });
      }

      if (parsed.length === 0) {
        if (unmatchedTickers.size > 0) {
          const list = Array.from(unmatchedTickers).sort().join(', ');
          setStatus({
            type: 'warning',
            message: `${recognizedCount} transação(ões) de compra/venda encontrada(s) no arquivo, mas nenhum destes ativos está cadastrado na sua carteira: ${list}. Cadastre esses ativos primeiro (aba Carteira) e importe o arquivo novamente.`,
          });
        } else {
          setStatus({
            type: 'warning',
            message: 'Nenhuma transação de compra/venda foi reconhecida no arquivo. Verifique se você exportou o extrato de Negociação (ou Movimentação) da Área do Investidor da B3 — extratos de proventos/dividendos não contêm compras e vendas.',
          });
        }
        setLoading(false);
        return;
      }

      if (unmatchedTickers.size > 0) {
        console.warn('[B3 Import] Tickers não cadastrados ignorados:', Array.from(unmatchedTickers));
      }

      const dups = parsed.filter(r => r.duplicate).length;
      const unmatchedNote = unmatchedTickers.size > 0
        ? ` ⚠️ Ativos não cadastrados foram ignorados: ${Array.from(unmatchedTickers).sort().join(', ')}.`
        : '';
      setPreview(parsed);
      setStatus({
        type: dups > 0 || unmatchedTickers.size > 0 ? 'warning' : 'info',
        message: `${parsed.length} transação(ões) encontrada(s). ${dups > 0 ? `⚠️ ${dups} já existem e serão ignoradas.` : 'Nenhuma duplicata detectada.'}${unmatchedNote} Revise e confirme.`,
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

    for (const row of preview) {
      if (row.duplicate) { skippedCount++; continue; }

      const asset = assets.find(a => a.id === row.assetId);
      if (!asset) continue;

      // Calcular PME para vendas — usa os dados do ativo no momento da importação
      let costBasis = 0;
      let profitLoss = 0;
      let isLoss = false;

      if (row.type === 'sell') {
        const totalQty = asset.quantity ?? 0;
        costBasis = calcPME(asset.investedValue, totalQty, row.quantity);
        profitLoss = parseFloat((row.value - costBasis).toFixed(2));
        isLoss = profitLoss < 0;
      }

      // Inserir transação — o índice único no banco rejeita duplicatas silenciosamente via upsert
      addTransaction({
        assetId: row.assetId,
        type: row.type,
        value: row.value,
        date: row.isoDate,
        notes: `Importado da B3 — Qtd: ${row.quantity} | Preço Unit: R$ ${row.price.toFixed(2)}`,
      });

      // Registrar IR para vendas
      if (row.type === 'sell') {
        const assetType: AssetType = asset.ticker.endsWith('11') || asset.ticker.endsWith('12') ? 'fii' : 'acao';
        addSellTaxRecord({
          assetId: row.assetId,
          assetTicker: row.ticker,
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
          notes: `Importado da B3 — Custo via PME (R$ ${(costBasis / (row.quantity || 1)).toFixed(2)}/cota × ${row.quantity} cotas)`,
          sellDate: row.dateDay,
        });
      }

      importedCount++;
    }

    setPreview(null);
    setConfirming(false);
    setStatus({
      type: 'success',
      message: `✅ ${importedCount} transações importadas com sucesso!${skippedCount > 0 ? ` ${skippedCount} duplicatas ignoradas.` : ''}`,
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
