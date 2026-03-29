'use client';

import React, { useState } from 'react';
import { PortfolioSummary } from '@/types';
import styles from './AiAnalysisCard.module.css';
import { Sparkles, Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  summary: PortfolioSummary;
  strategyName: string;
}

export default function AiAnalysisCard({ summary, strategyName }: Props) {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [hasRun, setHasRun] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setExpanded(true);

    // Monta o payload com apenas dados anônimos da carteira (sem info pessoal)
    const payload = {
      strategyName,
      healthScore: summary.healthScore,
      totalInvested: summary.totalInvested,
      totalValue: summary.totalValue,
      totalProfitLossPercent: summary.totalProfitLossPercent,
      needsRebalancing: summary.needsRebalancing,
      categories: summary.categorySummaries.map((cs) => ({
        class: cs.category.className,
        subclass: cs.category.subclassName,
        targetPercent: cs.targetPercent,
        currentPercent: parseFloat(cs.currentPercent.toFixed(2)),
        action: cs.action,
        rebalanceAmount: cs.rebalanceAmount,
      })),
      assets: summary.assetsWithCalcs.map((a) => ({
        ticker: a.ticker,
        subclass: a.category.subclassName,
        profitLossPercent: parseFloat(a.profitLossPercent.toFixed(2)),
        currentPortfolioPercent: parseFloat(a.currentPortfolioPercent.toFixed(2)),
        targetPercent: a.targetPercent,
        action: a.action,
      })),
    };

    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Erro ao contatar a IA. Verifique se a chave OPENAI_API_KEY está configurada.');
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      setHasRun(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.icon}>
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className={styles.title}>Análise IA da Carteira</h3>
            <p className={styles.subtitle}>Powered by GPT-4o-mini · Análise educacional</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {hasRun && (
            <button
              className={`btn btn-ghost btn-sm ${styles.collapseBtn}`}
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Recolher' : 'Expandir'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button
            id="ai-analyze-btn"
            className={`btn btn-primary ${styles.analyzeBtn}`}
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={14} className={styles.spinner} />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {hasRun ? 'Reanalisar' : 'Analisar com IA'}
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorBox}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {!hasRun && !loading && !error && (
        <div className={styles.placeholder}>
          <p>Clique em <strong>Analisar com IA</strong> para obter uma análise qualitativa da sua carteira em linguagem natural.</p>
          <p className={styles.placeholderNote}>
            💡 A IA avalia diversificação, desvios em relação à estratégia e pontos de atenção — sem recomendar ativos específicos.
          </p>
        </div>
      )}

      {hasRun && expanded && analysis && (
        <div className={styles.analysisBody}>
          <div className={styles.analysisText}>
            {parseCustomMarkdown(analysis)}
          </div>
          <div className={styles.disclaimer}>
            <AlertTriangle size={12} />
            <span>
              Esta análise é de caráter educacional e não constitui recomendação de investimento. Consulte um assessor habilitado antes de tomar decisões financeiras.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom Markdown Parser to avoid dependency issues
function parseCustomMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let currentList: React.ReactNode[] = [];
  let currentParagraphLines: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(<ul key={`ul-${elements.length}`} className={styles.list}>{currentList}</ul>);
      currentList = [];
    }
  };

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      // Remove espaços extras indesejados antes de vírgulas que possam surgir ao juntar linhas
      const pText = currentParagraphLines.join(' ').replace(/\s+([.,!?])/g, '$1');
      elements.push(<p key={`p-${elements.length}`} className={styles.p}>{applyInlineFormatting(pText)}</p>);
      currentParagraphLines = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushList();
      flushParagraph();
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushList();
      flushParagraph();
      elements.push(<h4 key={`h4-${index}`} className={styles.h4}>{applyInlineFormatting(trimmed.replace(/^###\s+/, ''))}</h4>);
    } 
    else if (trimmed.startsWith('## ')) {
      flushList();
      flushParagraph();
      elements.push(<h3 key={`h3-${index}`} className={styles.h3}>{applyInlineFormatting(trimmed.replace(/^##\s+/, ''))}</h3>);
    }
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph();
      currentList.push(<li key={`li-${index}`} className={styles.listItem}>{applyInlineFormatting(trimmed.slice(2))}</li>);
    } 
    else if (/^\d+\.\s/.test(trimmed)) {
      flushParagraph();
      const content = trimmed.replace(/^\d+\.\s/, '');
      currentList.push(<li key={`li-${index}`} className={styles.listItem}><strong>{trimmed.match(/^\d+\./)?.[0]}</strong> {applyInlineFormatting(content)}</li>);
    }
    else {
      flushList();
      currentParagraphLines.push(trimmed);
    }
  });

  flushList();
  flushParagraph();
  
  return elements;
}

// Aplica negrito inline para **texto**
function applyInlineFormatting(text: string): React.ReactNode {
  if (!text.includes('**')) return text;
  
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className={styles.bold}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
