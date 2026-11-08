// SearchBar.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { searchUniverses } from './data/universes';

export default function SearchBar({ onSelect, disabled = false }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const results = useMemo(() => searchUniverses(query), [query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commit = (universe) => {
    onSelect?.(universe);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(results[activeIndex >= 0 ? activeIndex : 0]);
    }
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        top: '2.1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(360px, calc(100vw - 12rem))',
        zIndex: 38,
        pointerEvents: 'none',
      }}
    >
      {/* Input Field */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          paddingBottom: '0.5rem',
          borderBottom: focused
            ? '1px solid rgba(255, 255, 255, 0.72)'
            : '1px solid rgba(255, 255, 255, 0.16)',
          transition: 'border-color 340ms ease',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            setOpen(true);
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search"
          aria-label="Search universes"
          aria-expanded={showDropdown}
          aria-controls="universe-search-results"
          style={{
            pointerEvents: 'auto',
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: '#ffffff',
            fontSize: '0.82rem',
            fontWeight: 400,
            letterSpacing: '0.08em',
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            padding: 0,
          }}
        />

        <kbd
          style={{
            flexShrink: 0,
            fontSize: '0.58rem',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.28)',
            fontFamily: 'inherit',
          }}
        >
          ⌘K
        </kbd>
      </div>

      {/* Results Dropdown */}
      {showDropdown && (
        <ul
          id="universe-search-results"
          role="listbox"
          style={{
            pointerEvents: 'auto',
            margin: 0,
            marginTop: '1.1rem',
            padding: 0,
            listStyle: 'none',
            maxHeight: '46vh',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {results.length === 0 && (
            <li
              style={{
                fontSize: '0.78rem',
                fontWeight: 300,
                letterSpacing: '0.02em',
                color: 'rgba(255, 255, 255, 0.32)',
                padding: '0.45rem 0',
              }}
            >
              No match
            </li>
          )}

          {results.map((u, i) => {
            const isLit = i === activeIndex;
            return (
              <li key={u.id} role="option" aria-selected={isLit}>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    commit(u);
                  }}
                  onPointerEnter={() => setActiveIndex(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '1.25rem',
                    width: '100%',
                    padding: '0.5rem 0',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    color: isLit ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                    transition: 'color 220ms ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 300,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {u.name}
                  </span>

                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: '0.56rem',
                      fontWeight: 400,
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: isLit
                        ? 'rgba(255, 255, 255, 0.52)'
                        : 'rgba(255, 255, 255, 0.22)',
                      transition: 'color 220ms ease',
                    }}
                  >
                    {u.genre}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
