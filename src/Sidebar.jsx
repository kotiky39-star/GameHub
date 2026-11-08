// Sidebar.jsx
import { useEffect, useState } from 'react';
import { UNIVERSES } from './data/universes';
import { useUniverseStore } from './store/useUniverseStore';

const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

export default function Sidebar({ visible = true }) {
  const sidebarOpen = useUniverseStore((s) => s.sidebarOpen);
  const toggleSidebar = useUniverseStore((s) => s.toggleSidebar);
  const selectedId = useUniverseStore((s) => s.selectedId);

  const [hoveredId, setHoveredId] = useState(null);

  /* Escape closes the index */
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') toggleSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, toggleSidebar]);

  const handleSelect = (id) => {
    useUniverseStore.getState().selectUniverse(id);
  };

  const shown = visible && sidebarOpen;

  return (
    <>
      {/* ============ Toggle — bare text, under the wordmark ============ */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Close index' : 'Open index'}
        aria-expanded={sidebarOpen}
        style={{
          position: 'fixed',
          top: '4.6rem', // 2.25rem (logo top) + logo height + gap
          left: '2.5rem',
          zIndex: 40,

          /* Real hitbox — the text is small, so pad it out invisibly. */
          padding: '0.75rem 1.5rem 0.75rem 0',
          marginLeft: '-0rem',

          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: FONT,
          fontSize: '0.6rem',
          fontWeight: 400,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: sidebarOpen
            ? '#ffffff'
            : 'rgba(255, 255, 255, 0.42)',
          transition: 'color 300ms ease, opacity 700ms ease',
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#ffffff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = sidebarOpen
            ? '#ffffff'
            : 'rgba(255, 255, 255, 0.42)';
        }}
      >
        {sidebarOpen ? 'Close' : 'Index'}
      </button>

      {/* ============ Contrast scrim — fades right, no hard edge ============ */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 'min(620px, 78vw)',
          zIndex: 34,
          pointerEvents: 'none',
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 100%)',
          opacity: shown ? 1 : 0,
          transition: 'opacity 620ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {/* ============ List ============ */}
      <nav
        aria-hidden={!shown}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 36,
          width: 'min(400px, 84vw)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: '2.5rem',
          paddingRight: '2.5rem',
          boxSizing: 'border-box',
          background: 'transparent',
          fontFamily: FONT,
          pointerEvents: shown ? 'auto' : 'none',
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateX(0)' : 'translateX(-24px)',
          transition:
            'opacity 560ms cubic-bezier(0.22, 1, 0.36, 1), transform 560ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            maxHeight: '64vh',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {UNIVERSES.map((u, i) => {
            const isActive = u.id === selectedId;
            const isHovered = hoveredId === u.id;
            const isLit = isActive || isHovered;

            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(u.id)}
                  onMouseEnter={() => setHoveredId(u.id)}
                  onMouseLeave={() =>
                    setHoveredId((cur) => (cur === u.id ? null : cur))
                  }
                  aria-current={isActive ? 'true' : undefined}
                  style={{
                    /* Full-width clickable block — no dead zones. */
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr',
                    alignItems: 'start',
                    columnGap: '0.25rem',
                    width: '100%',
                    padding: '1rem 0',
                    border: 'none',
                    borderBottom: isLit
                      ? '1px solid rgba(255, 255, 255, 0.4)'
                      : '1px solid transparent',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: FONT,
                    color: 'inherit',
                    transition: 'border-color 320ms ease',
                  }}
                >
                  {/* ---- Column 1: index ---- */}
                  <span
                    style={{
                      fontSize: '0.58rem',
                      fontWeight: 300,
                      letterSpacing: '0.12em',
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: '1.9',
                      color: isLit
                        ? 'rgba(255, 255, 255, 0.6)'
                        : 'rgba(255, 255, 255, 0.22)',
                      transition: 'color 320ms ease',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  {/* ---- Column 2: name + genre ---- */}
                  <span style={{ display: 'block', minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '1.1rem',
                        fontWeight: 400,
                        letterSpacing: '-0.015em',
                        lineHeight: 1.28,
                        color: isLit ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
                        transition: 'color 320ms ease',
                      }}
                    >
                      {u.name}
                    </span>

                    <span
                      style={{
                        display: 'block',
                        marginTop: '0.34rem',
                        fontSize: '0.7rem',
                        fontWeight: 300,
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        lineHeight: 1.3,
                        color: isLit
                          ? 'rgba(255, 255, 255, 0.5)'
                          : 'rgba(255, 255, 255, 0.24)',
                        transition: 'color 320ms ease',
                      }}
                    >
                      {u.genre}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
