'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { calculatePortfolio } from '@/lib/calculations';
import { Bot, SendHorizonal, AlertTriangle, Trash2, Sparkles } from 'lucide-react';
import styles from './AiChat.module.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

// ── Quick suggestions ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'O que é rebalanceamento de carteira?',
  'Como funciona o IR sobre ações?',
  'Explique o que são FIIs',
  'O que é diversificação de ativos?',
  'Como analisar minha carteira atual?',
  'Qual a diferença entre ETF e ação?',
];

// ── Markdown parser (reaproveitado do AiAnalysisCard) ─────────────────────────

function parseCustomMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let currentParagraphLines: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '6px 0 6px 18px', padding: 0 }}>
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join(' ').replace(/\s+([.,!?])/g, '$1');
      elements.push(
        <p key={`p-${elements.length}`} style={{ margin: '6px 0', fontSize: '13.5px', lineHeight: 1.65 }}>
          {applyInlineFormatting(pText)}
        </p>
      );
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

    if (trimmed.startsWith('## ')) {
      flushList();
      flushParagraph();
      elements.push(
        <h3 key={`h3-${index}`} style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary-light)', margin: '12px 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {applyInlineFormatting(trimmed.replace(/^##\s+/, ''))}
        </h3>
      );
    } else if (trimmed.startsWith('### ')) {
      flushList();
      flushParagraph();
      elements.push(
        <h4 key={`h4-${index}`} style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text)', margin: '10px 0 3px' }}>
          {applyInlineFormatting(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph();
      currentList.push(
        <li key={`li-${index}`} style={{ fontSize: '13px', color: 'var(--color-text-2)', margin: '4px 0', lineHeight: 1.55, listStyleType: 'disc' }}>
          {applyInlineFormatting(trimmed.slice(2))}
        </li>
      );
    } else {
      flushList();
      currentParagraphLines.push(trimmed);
    }
  });

  flushList();
  flushParagraph();

  return elements;
}

function applyInlineFormatting(text: string): React.ReactNode {
  if (!text.includes('**')) return text;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 600, color: 'var(--color-text)' }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiChat() {
  const { activeAssets, activeStrategy } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize do textarea
  const handleTextareaInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // Monta o contexto anônimo da carteira
  const buildPortfolioContext = useCallback(() => {
    if (!activeStrategy || activeAssets.length === 0) return undefined;

    try {
      const summary = calculatePortfolio(activeStrategy, activeAssets);
      return {
        strategyName: activeStrategy.name,
        healthScore: summary.healthScore,
        totalProfitLossPercent: summary.totalProfitLossPercent,
        needsRebalancing: summary.needsRebalancing,
        categories: summary.categorySummaries.map((cs) => ({
          class: cs.category.className,
          subclass: cs.category.subclassName,
          targetPercent: cs.targetPercent,
          currentPercent: parseFloat(cs.currentPercent.toFixed(2)),
          action: cs.action,
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
    } catch {
      return undefined;
    }
  }, [activeAssets, activeStrategy]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const portfolioContext = buildPortfolioContext();

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content }) => ({ role, content })),
          portfolioContext,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: data.error ?? 'Erro ao contatar a IA.',
            error: true,
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Erro desconhecido.',
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
      // Recoloca foco no textarea após resposta
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [loading, messages, buildPortfolioContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleClear = () => {
    if (messages.length === 0) return;
    if (confirm('Limpar o histórico de conversa?')) {
      setMessages([]);
    }
  };

  const hasContext = activeAssets.length > 0 && !!activeStrategy;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Bot size={22} />
        </div>
        <div className={styles.headerText}>
          <h1>Assistente IA</h1>
          <p>
            Powered by GPT-4o-mini ·{' '}
            {hasContext ? `Contexto: ${activeStrategy?.name}` : 'Perguntas sobre finanças e investimentos'}
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className={styles.disclaimerCard}>
        <AlertTriangle size={16} className={styles.disclaimerIcon} />
        <p className={styles.disclaimerText}>
          <strong>Ferramenta educacional.</strong> Este assistente responde dúvidas sobre finanças e investimentos com base no mercado brasileiro,{' '}
          <strong>sem fazer recomendações de compra ou venda</strong> de ativos específicos. Para decisões de investimento, consulte um assessor habilitado pela CVM.
        </p>
      </div>

      {/* Chat card */}
      <div className={styles.chatCard}>
        {/* Messages */}
        <div className={styles.messages}>
          {messages.length === 0 && !loading ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <Sparkles size={28} />
              </div>
              <div>
                <p className={styles.emptyTitle}>Como posso ajudar?</p>
                <p className={styles.emptySubtitle}>
                  Tire dúvidas sobre investimentos, conceitos financeiros e{hasContext ? ' sobre a sua carteira atual.' : ' muito mais.'}
                </p>
              </div>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className={styles.suggestionChip}
                    onClick={() => sendMessage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${msg.role === 'user' ? styles.messageRowUser : ''}`}
                >
                  <div className={`${styles.avatar} ${msg.role === 'assistant' ? styles.avatarAI : styles.avatarUser}`}>
                    {msg.role === 'assistant' ? <Bot size={16} /> : '👤'}
                  </div>
                  <div className={`${styles.bubble} ${msg.role === 'assistant' ? styles.bubbleAI : styles.bubbleUser}`}>
                    {msg.error ? (
                      <div className={styles.errorBubble}>
                        <AlertTriangle size={14} />
                        <span>{msg.content}</span>
                      </div>
                    ) : msg.role === 'assistant' ? (
                      parseCustomMarkdown(msg.content)
                    ) : (
                      <p style={{ margin: 0, color: 'inherit' }}>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Indicador de digitação */}
              {loading && (
                <div className={styles.messageRow}>
                  <div className={`${styles.avatar} ${styles.avatarAI}`}>
                    <Bot size={16} />
                  </div>
                  <div className={`${styles.bubble} ${styles.bubbleAI}`}>
                    <div className={styles.typingBubble}>
                      <span className={styles.typingDot} />
                      <span className={styles.typingDot} />
                      <span className={styles.typingDot} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className={styles.inputArea}>
          <div className={styles.inputRow}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              placeholder="Escreva sua pergunta... (Enter para enviar, Shift+Enter para nova linha)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleTextareaInput}
              rows={1}
              disabled={loading}
            />
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              title="Enviar mensagem"
            >
              <SendHorizonal size={18} />
            </button>
          </div>
          <div className={styles.inputHint}>
            <span>Enter para enviar · Shift+Enter para nova linha</span>
            {messages.length > 0 && (
              <button className={styles.clearBtn} onClick={handleClear} title="Limpar conversa">
                <Trash2 size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                Limpar conversa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
