// src/components/UniversePanel.jsx
import { useEffect, useState } from 'react';

export default function UniversePanel({ universe, onClose, onEnter }) {
  const [entered, setEntered] = useState(false);
  const open = Boolean(universe);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!universe) return null;

  const visible = entered;

  return (
    <div
      aria-hidden={!open}
      role="dialog"
      aria-label={universe.name}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        pointerEvents: visible ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 620ms cubic-bezier(0.22, 1, 0.36, 1)',
        background:
          'radial-gradient(120% 100% at 50% 50%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.88) 58%, rgba(0,0,0,0.96) 100%)',
        color: '#ffffff',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Close Button */}
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: '2.25rem',
          right: '2.5rem',
          zIndex: 60,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '0.7rem',
          fontWeight: 500,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          fontFamily: 'inherit',
          transition: 'color 300ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#ffffff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
        }}
      >
        Close
      </button>

      {/* Editorial Layout */}
      <div
        style={{
          minHeight: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          alignContent: 'center',
          padding: '7rem 2.5rem 6rem',
          maxWidth: '1180px',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Eyebrow Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '2rem',
            paddingBottom: '1.6rem',
            marginBottom: 'clamp(1.5rem, 4vw, 2.6rem)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.14)',
          }}
        >
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 400,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.42)',
            }}
          >
            {universe.genre}
          </span>

          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 400,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#c8a961',
            }}
          >
            Universe
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            fontWeight: 300,
            lineHeight: 0.94,
            letterSpacing: '-0.045em',
            color: '#ffffff',
          }}
        >
          {universe.name}
        </h1>

        {/* Body Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'clamp(2rem, 5vw, 4.5rem)',
            marginTop: 'clamp(2.5rem, 6vw, 4.5rem)',
          }}
        >
          {/* Column Marker */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.4rem',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'block',
                width: '100%',
                height: 1,
                background:
                  'linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0))',
              }}
            />
            <p
              style={{
                margin: 0,
                fontSize: '0.66rem',
                fontWeight: 400,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.36)',
              }}
            >
              Lore
            </p>
          </div>

          {/* Lore Text */}
          <p
            style={{
              margin: 0,
              fontSize: 'clamp(0.95rem, 1.15vw, 1.06rem)',
              fontWeight: 300,
              lineHeight: 1.78,
              letterSpacing: '0.004em',
              color: 'rgba(255, 255, 255, 0.78)',
              maxWidth: '58ch',
            }}
          >
            {universe.lore}
          </p>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 'clamp(3rem, 7vw, 5.5rem)' }}>
          <button
            type="button"
            onClick={() => onEnter?.(universe)}
            style={{
              position: 'relative',
              display: 'inline-block',
              padding: '0 0 0.55rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              fontWeight: 500,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              const rule = e.currentTarget.querySelector('[data-rule]');
              if (rule) rule.style.width = '100%';
            }}
            onMouseLeave={(e) => {
              const rule = e.currentTarget.querySelector('[data-rule]');
              if (rule) rule.style.width = '38%';
            }}
          >
            Enter Universe
            <span
              data-rule=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                height: 1,
                width: '38%',
                background: '#c8a961',
                transition: 'width 520ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
