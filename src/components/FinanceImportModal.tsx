'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  X, ScanLine, Camera, FileUp, ShieldCheck, AlertTriangle, Sparkles,
} from 'lucide-react';
import {
  AiImportResult, FinanceSection, FinanceTransaction, FinanceTransactionType,
} from '@/types';
import { isCardCategory } from '@/lib/financeCategories';
import shared from '@/views/Finances.module.css';
import styles from './FinanceImportModal.module.css';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const DOC_LABELS: Record<AiImportResult['documentType'], string> = {
  fatura_cartao: 'Fatura de cartão',
  extrato: 'Extrato',
  cupom: 'Cupom fiscal',
  recibo: 'Recibo',
  boleto: 'Boleto',
  outro: 'Documento',
};

const MAX_PDF_BYTES = 3 * 1024 * 1024;
const IMAGE_MAX_DIM = 1800;

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Redimensiona e re-encoda a imagem como JPEG — resolve HEIC do iPhone,
 *  limite de body da Vercel e custo de tokens de uma vez só. */
async function imageToJpegBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('decode'));
      i.src = url;
    });
    const scale = Math.min(1, IMAGE_MAX_DIM / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

/** Data padrão para itens sem data: hoje, se hoje pertence ao mês ativo; senão dia 1º. */
function fallbackDate(monthStr: string): string {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return today.startsWith(monthStr) ? today : `${monthStr}-01`;
}

interface ReviewRow {
  id: number;
  selected: boolean;
  duplicate: boolean;
  description: string;
  valueStr: string;
  date: string;      // '' quando o documento não mostra
  category: string;  // '' = sem categoria
  type: FinanceTransactionType;
}

type Step = 'select' | 'processing' | 'review';
type Mode = 'detalhado' | 'unico';

export default function FinanceImportModal({
  monthId, monthStr, categories, monthTxs, onClose, onConfirm,
}: {
  monthId: string;
  monthStr: string; // YYYY-MM do mês ativo
  categories: string[];
  monthTxs: FinanceTransaction[];
  onClose: () => void;
  onConfirm: (list: Omit<FinanceTransaction, 'id' | 'createdAt'>[]) => void;
}) {
  const [step, setStep] = useState<Step>('select');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<AiImportResult | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [expenseSection, setExpenseSection] = useState<Exclude<FinanceSection, 'assinatura' | 'income'>>('extra');
  const [mode, setMode] = useState<Mode>('detalhado');

  // Modo "valor único" (fatura inteira como um lançamento só)
  const [singleDesc, setSingleDesc] = useState('');
  const [singleValueStr, setSingleValueStr] = useState('');
  const [singleDate, setSingleDate] = useState('');
  const [singleCat, setSingleCat] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.localeCompare(b)), [categories]);

  const handleFile = async (file: File) => {
    setError(null);

    let base64: string;
    let mimeType: string;

    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        if (file.size > MAX_PDF_BYTES) {
          setError('PDF muito grande (limite ~3 MB). Exporte só as páginas da fatura e tente de novo.');
          return;
        }
        base64 = await fileToBase64(file);
        mimeType = 'application/pdf';
      } else {
        base64 = await imageToJpegBase64(file);
        mimeType = 'image/jpeg';
      }
    } catch {
      setError('Não consegui ler este arquivo. Use uma foto JPG/PNG ou um PDF.');
      return;
    }

    setStep('processing');
    try {
      const res = await fetch('/api/finance-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, mimeType, categories, monthRef: monthStr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error || `Erro ${res.status}`);
      }

      const r = (data as { result: AiImportResult }).result;
      if (!r || r.items.length === 0) {
        setError('Nenhum lançamento encontrado no documento. Tente uma foto mais nítida ou o PDF original.');
        setStep('select');
        return;
      }

      // Possíveis duplicados: mesma descrição (normalizada) e mesmo valor no mês
      const existing = new Set(monthTxs.map(t => `${normalize(t.description)}|${t.value.toFixed(2)}`));
      setRows(r.items.map((it, i) => {
        const duplicate = existing.has(`${normalize(it.description)}|${it.value.toFixed(2)}`);
        return {
          id: i,
          selected: !duplicate,
          duplicate,
          description: it.description,
          valueStr: String(it.value),
          date: it.date ?? '',
          category: it.category ?? '',
          type: it.type,
        };
      }));

      // Pré-preenche o modo "valor único" (fatura como um lançamento só)
      const total = r.totalDetected ?? Math.round(r.items.reduce((s, it) => s + it.value, 0) * 100) / 100;
      const ref = r.referenceMonth ? ` (${r.referenceMonth.split('-')[1]}/${r.referenceMonth.split('-')[0]})` : '';
      setSingleDesc(`${DOC_LABELS[r.documentType]}${ref}`);
      setSingleValueStr(String(total));
      setSingleDate(fallbackDate(monthStr));
      setSingleCat(sortedCategories.find(c => isCardCategory(c)) ?? '');

      setResult(r);
      setMode('detalhado');
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar o documento.');
      setStep('select');
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const updateRow = (id: number, patch: Partial<ReviewRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const selectedRows = rows.filter(r => r.selected);
  const allSelected = rows.length > 0 && rows.every(r => r.selected);
  const parseVal = (s: string) => parseFloat(s.replace(',', '.'));
  const sumSelected = selectedRows.reduce((s, r) => {
    const v = parseVal(r.valueStr);
    return s + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);

  const totalMatches = result?.totalDetected != null && Math.abs(sumSelected - result.totalDetected) < 0.01;

  const singleValue = parseVal(singleValueStr);
  const canConfirm = mode === 'unico'
    ? !!singleDesc.trim() && Number.isFinite(singleValue) && singleValue > 0
    : selectedRows.length > 0 && selectedRows.every(r => {
        const v = parseVal(r.valueStr);
        return Number.isFinite(v) && v > 0 && !!r.description.trim();
      });

  const handleConfirm = () => {
    if (!canConfirm) return;

    if (mode === 'unico') {
      onConfirm([{
        monthId,
        type: 'expense',
        section: 'boleto',
        description: singleDesc.trim(),
        value: Math.round(singleValue * 100) / 100,
        date: singleDate || fallbackDate(monthStr),
        category: singleCat || undefined,
        dueDay: singleDate ? new Date(`${singleDate}T12:00:00`).getDate() : undefined,
        paymentStatus: 'pending',
      }]);
      return;
    }

    onConfirm(selectedRows.map(r => {
      const isIncome = r.type === 'income';
      const section: FinanceSection = isIncome ? 'income' : expenseSection;
      const date = r.date || fallbackDate(monthStr);
      return {
        monthId,
        type: r.type,
        section,
        description: r.description.trim(),
        value: Math.round(parseVal(r.valueStr) * 100) / 100,
        date,
        category: isIncome ? undefined : (r.category || undefined),
        dueDay: section === 'boleto' ? new Date(`${date}T12:00:00`).getDate() : undefined,
        // Item vindo de fatura/cupom já aconteceu → extra nasce pago;
        // conta recorrente importada nasce pendente para não sumir do radar
        paymentStatus: isIncome ? undefined : (section === 'boleto' ? 'pending' : 'paid'),
      };
    }));
  };

  // Revisão em andamento: fechar só pelo X, para não perder o trabalho num clique fora
  const overlayClose = step === 'select' ? onClose : undefined;

  return (
    <div className={shared.overlay} onClick={overlayClose}>
      <div className={shared.modalFlex} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Importar lançamentos com IA">
        <div className={shared.modalHead}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ScanLine size={18} style={{ color: 'var(--color-primary-light)' }} /> Importar com IA
          </h3>
          <button className={shared.closeBtn} onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>

        {/* ── Passo 1: captura ── */}
        {step === 'select' && (
          <div className={shared.modalScrollBody}>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-2)', lineHeight: 1.55, margin: 0 }}>
              Envie uma <strong style={{ color: 'var(--color-text)' }}>foto</strong> ou o{' '}
              <strong style={{ color: 'var(--color-text)' }}>PDF</strong> de uma fatura de cartão,
              cupom, recibo ou boleto. A IA lê o documento e sugere os lançamentos —{' '}
              <strong style={{ color: 'var(--color-text)' }}>você revisa tudo antes de salvar</strong>.
            </p>

            {error && (
              <div className={styles.errorBox} role="alert">
                <AlertTriangle size={15} /> {error}
              </div>
            )}

            <div
              className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            >
              <FileUp size={30} className={styles.dropIcon} />
              <span className={styles.dropTitle}>Arraste o arquivo aqui ou clique para escolher</span>
              <span className={styles.dropHint}>JPG, PNG, WebP ou PDF · até ~3 MB · fotos são comprimidas automaticamente</span>
            </div>

            <div className={styles.captureRow}>
              <button className={shared.btnGhost} onClick={() => cameraInputRef.current?.click()}>
                <Camera size={15} /> Tirar foto
              </button>
              <button className={shared.btnGhost} onClick={() => fileInputRef.current?.click()}>
                <FileUp size={15} /> Escolher arquivo
              </button>
            </div>

            <p className={styles.privacyNote}>
              <ShieldCheck size={13} />
              <span>O documento é enviado com segurança ao provedor de IA (OpenAI) apenas para leitura e não é usado para treinar modelos. Nada é salvo sem a sua confirmação.</span>
            </p>

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={onInputChange} hidden />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onInputChange} hidden />
          </div>
        )}

        {/* ── Passo 2: processando ── */}
        {step === 'processing' && (
          <div className={styles.processing}>
            <ScanLine size={38} className={styles.processingIcon} />
            <p className={styles.processingTitle}>Lendo o documento…</p>
            <p className={styles.processingSub}>A IA está identificando os lançamentos. Isso leva de 10 a 30 segundos.</p>
          </div>
        )}

        {/* ── Passo 3: revisão ── */}
        {step === 'review' && result && (
          <>
            <div className={shared.modalScrollBody}>
              <div className={styles.docMeta}>
                <span className={styles.docBadge}><Sparkles size={11} /> {DOC_LABELS[result.documentType]}</span>
                {result.referenceMonth && <span>ref. {result.referenceMonth.split('-').reverse().join('/')}</span>}
                {result.totalDetected != null && <span>· total do documento {fmt(result.totalDetected)}</span>}
                <span>· {rows.length} {rows.length === 1 ? 'item' : 'itens'}</span>
              </div>

              {result.documentType === 'fatura_cartao' && rows.length > 1 && (
                <div className={styles.modeRow} role="tablist" aria-label="Forma de lançamento">
                  <button role="tab" aria-selected={mode === 'detalhado'} className={`${styles.modeBtn} ${mode === 'detalhado' ? styles.modeActive : ''}`} onClick={() => setMode('detalhado')}>
                    Itens detalhados ({rows.length})
                  </button>
                  <button role="tab" aria-selected={mode === 'unico'} className={`${styles.modeBtn} ${mode === 'unico' ? styles.modeActive : ''}`} onClick={() => setMode('unico')}>
                    Fatura como valor único
                  </button>
                </div>
              )}

              {mode === 'detalhado' && (
                <>
                  <div className={styles.sectionChoice}>
                    <span className={styles.sectionChoiceLabel}>Lançar saídas em:</span>
                    <div className={styles.modeRow} style={{ flex: 1, minWidth: 200 }}>
                      <button className={`${styles.modeBtn} ${expenseSection === 'extra' ? styles.modeActive : ''}`} onClick={() => setExpenseSection('extra')}>
                        Gastos Extras
                      </button>
                      <button className={`${styles.modeBtn} ${expenseSection === 'boleto' ? styles.modeActive : ''}`} onClick={() => setExpenseSection('boleto')}>
                        Recorrentes
                      </button>
                    </div>
                  </div>

                  <label className={styles.selectAllRow}>
                    <input
                      type="checkbox"
                      className={shared.importCheck}
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = !allSelected && selectedRows.length > 0; }}
                      onChange={() => setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })))}
                    />
                    {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </label>

                  {rows.map(row => (
                    <div key={row.id} className={`${styles.itemRow} ${!row.selected ? styles.itemRowOff : ''} ${row.duplicate ? styles.itemRowDup : ''}`}>
                      <input
                        type="checkbox"
                        className={shared.importCheck}
                        checked={row.selected}
                        onChange={() => updateRow(row.id, { selected: !row.selected })}
                        aria-label={`Incluir ${row.description}`}
                      />
                      <div className={styles.itemMain}>
                        <input
                          className={styles.itemDescInput}
                          value={row.description}
                          onChange={e => updateRow(row.id, { description: e.target.value })}
                          aria-label="Descrição"
                        />
                        <div className={styles.itemMeta}>
                          <input
                            type="date"
                            className={styles.itemSmallInput}
                            value={row.date}
                            onChange={e => updateRow(row.id, { date: e.target.value })}
                            aria-label="Data"
                          />
                          {row.type === 'expense' && (
                            <select
                              className={styles.itemSmallInput}
                              value={row.category}
                              onChange={e => updateRow(row.id, { category: e.target.value })}
                              aria-label="Categoria"
                            >
                              <option value="">Sem categoria</option>
                              {sortedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          )}
                          {row.type === 'income' && <span className={styles.dupBadge} style={{ color: '#10B981' }}>Receita</span>}
                          {row.duplicate && (
                            <span className={styles.dupBadge}><AlertTriangle size={11} /> possível duplicado</span>
                          )}
                        </div>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        className={styles.itemValueInput}
                        value={row.valueStr}
                        onChange={e => updateRow(row.id, { valueStr: e.target.value })}
                        aria-label="Valor"
                      />
                    </div>
                  ))}
                </>
              )}

              {mode === 'unico' && (
                <>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-2)', lineHeight: 1.55, margin: 0 }}>
                    A fatura inteira vira <strong style={{ color: 'var(--color-text)' }}>um único lançamento recorrente</strong> —
                    ideal se você acompanha o cartão pelo total, não pelas compras.
                  </p>
                  <div className={shared.formGroup}>
                    <label>Descrição</label>
                    <input className={shared.input} value={singleDesc} onChange={e => setSingleDesc(e.target.value)} />
                  </div>
                  <div className={shared.formRow}>
                    <div className={shared.formGroup}>
                      <label>Valor (R$)</label>
                      <input type="number" step="0.01" min="0.01" inputMode="decimal" className={shared.input} value={singleValueStr} onChange={e => setSingleValueStr(e.target.value)} />
                    </div>
                    <div className={shared.formGroup}>
                      <label>Data</label>
                      <input type="date" className={shared.input} value={singleDate} onChange={e => setSingleDate(e.target.value)} />
                    </div>
                  </div>
                  <div className={shared.formGroup}>
                    <label>Categoria</label>
                    <select className={shared.input} value={singleCat} onChange={e => setSingleCat(e.target.value)}>
                      <option value="">Sem categoria</option>
                      {sortedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className={shared.modalFooter}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {mode === 'detalhado' ? (
                  <>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {selectedRows.length} de {rows.length} · {fmt(sumSelected)}
                    </div>
                    {result.totalDetected != null && (
                      <div className={styles.totalCheck}>
                        {totalMatches
                          ? <span className={styles.totalOk}>✓ bate com o total do documento</span>
                          : <span className={styles.totalWarn}>total do documento: {fmt(result.totalDetected)}</span>}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>
                    1 lançamento · {Number.isFinite(singleValue) && singleValue > 0 ? fmt(singleValue) : '—'}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={shared.submitBtn}
                style={{ margin: 0, padding: '0.6rem 1.5rem', opacity: canConfirm ? 1 : 0.5 }}
                disabled={!canConfirm}
                onClick={handleConfirm}
              >
                {mode === 'unico' ? 'Adicionar lançamento' : `Adicionar ${selectedRows.length} lançamento${selectedRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
