'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './TickerSearch.module.css';
import { Search, Loader2, X } from 'lucide-react';

interface TickerSuggestion {
  ticker: string;
  name: string;
  source: 'brapi' | 'manual';
}

interface Props {
  value: string;
  onChange: (ticker: string, name?: string) => void;
}

// Busca na brapi.dev (B3 - Brasil)
async function searchBrapi(query: string): Promise<TickerSuggestion[]> {
  try {
    const res = await fetch(
      `https://brapi.dev/api/quote/list?search=${encodeURIComponent(query)}&limit=8`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const stocks: { stock: string; name: string }[] = data?.stocks ?? [];
    return stocks.map((s) => ({
      ticker: s.stock,
      name: s.name,
      source: 'brapi' as const,
    }));
  } catch {
    return [];
  }
}

export default function TickerSearch({ value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Atualiza query se valor externo mudar (edição)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const results = await searchBrapi(q);
    setSuggestions(results);
    setOpen(results.length > 0);
    setHighlighted(-1);
    setLoading(false);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setQuery(val);
    onChange(val); // Atualiza o parent imediatamente com o texto digitado
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (suggestion: TickerSuggestion) => {
    setQuery(suggestion.ticker);
    setSuggestions([]);
    setOpen(false);
    onChange(suggestion.ticker, suggestion.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    onChange('');
  };

  return (
    <div ref={containerRef} className={styles.wrapper}>
      <div className={styles.inputWrapper}>
        <Search size={14} className={styles.searchIcon} />
        <input
          id="asset-ticker"
          className={`input ${styles.input}`}
          placeholder="Ex: IVVB11, PETR4, IMAB11..."
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && suggestions.length > 0 && setOpen(true)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <Loader2 size={14} className={styles.spinner} />}
        {!loading && query && (
          <button type="button" className={styles.clearBtn} onClick={handleClear}>
            <X size={12} />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className={styles.dropdown} role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s.ticker}
              className={`${styles.item} ${i === highlighted ? styles.itemHighlighted : ''}`}
              onMouseDown={() => handleSelect(s)}
              role="option"
              aria-selected={i === highlighted}
            >
              <span className={styles.itemTicker}>{s.ticker}</span>
              <span className={styles.itemName}>{s.name}</span>
            </li>
          ))}
          <li className={styles.footer}>
            Dados: brapi.dev (B3) · Ou digite qualquer ticker manualmente
          </li>
        </ul>
      )}
    </div>
  );
}
