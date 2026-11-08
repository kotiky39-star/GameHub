import { Link } from 'wouter';
import { UNIVERSES } from '../data/universes';

export default function HubPage() {
  const popular = UNIVERSES.slice(0, 12);
  const genres = [...new Set(UNIVERSES.map(u => u.genre))].sort();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080914',
      color: '#ffffff',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      overflowY: 'auto',
    }}>
      {/* Header */}
      <header style={{
        padding: '2rem 3rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        background: 'rgba(8,9,20,0.92)',
        backdropFilter: 'blur(12px)',
        zIndex: 10,
      }}>
        <div>
          <span style={{
            fontSize: '0.58rem',
            fontWeight: 400,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
          }}>
            Nexus
          </span>
          <h1 style={{
            margin: '0.3rem 0 0',
            fontSize: '1.5rem',
            fontWeight: 300,
            letterSpacing: '-0.02em',
          }}>
            The Singularity
          </h1>
        </div>
        <Link href="/" style={{
          padding: '0.6rem 1.6rem',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'transparent',
          color: '#ffffff',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '0.7rem',
          fontWeight: 500,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          transition: 'border-color 280ms ease, color 280ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
        >
          ← Back to Galaxy
        </Link>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '4rem 2rem' }}>
        {/* Hero */}
        <section style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <p style={{
            fontSize: '0.62rem',
            fontWeight: 400,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
            marginBottom: '1rem',
          }}>
            Community Hub
          </p>
          <h2 style={{
            margin: 0,
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 300,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
          }}>
            Where every universe converges
          </h2>
          <p style={{
            marginTop: '1.5rem',
            fontSize: '0.95rem',
            fontWeight: 300,
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.45)',
            maxWidth: '48ch',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            The gravitational center of the archive. Share lore, discuss theories,
            and explore connections between 99 gaming universes.
          </p>
        </section>

        {/* Stats */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1.5rem',
          marginBottom: '5rem',
        }}>
          {[
            { label: 'Universes', value: UNIVERSES.length },
            { label: 'Genres', value: genres.length },
            { label: 'Stories', value: '∞' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: '1.5rem',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <p style={{
                margin: 0,
                fontSize: '1.8rem',
                fontWeight: 300,
                letterSpacing: '-0.02em',
              }}>
                {value}
              </p>
              <p style={{
                margin: '0.4rem 0 0',
                fontSize: '0.6rem',
                fontWeight: 400,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)',
              }}>
                {label}
              </p>
            </div>
          ))}
        </section>

        {/* Popular Universes */}
        <section style={{ marginBottom: '5rem' }}>
          <h3 style={{
            margin: '0 0 2rem',
            fontSize: '0.62rem',
            fontWeight: 400,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
          }}>
            Near the Singularity
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            {popular.map((u, i) => (
              <Link key={u.id} href={`/enter/${u.id}`} style={{
                display: 'block',
                padding: '1.2rem 1.4rem',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.02)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 280ms ease, background 280ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              }}
              >
                <p style={{
                  margin: 0,
                  fontSize: '0.88rem',
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                }}>
                  {u.name}
                </p>
                <p style={{
                  margin: '0.4rem 0 0',
                  fontSize: '0.6rem',
                  fontWeight: 300,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.25)',
                }}>
                  {u.genre}
                </p>
                <span style={{
                  position: 'absolute',
                  top: '1.2rem',
                  right: '1.4rem',
                  fontSize: '0.55rem',
                  color: 'rgba(255,255,255,0.15)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  #{i + 1}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Genres */}
        <section style={{ marginBottom: '5rem' }}>
          <h3 style={{
            margin: '0 0 2rem',
            fontSize: '0.62rem',
            fontWeight: 400,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
          }}>
            Genre Distribution
          </h3>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem',
          }}>
            {genres.map(g => {
              const count = UNIVERSES.filter(u => u.genre === g).length;
              return (
                <span key={g} style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '20px',
                  fontSize: '0.68rem',
                  fontWeight: 300,
                  letterSpacing: '0.08em',
                  color: 'rgba(255,255,255,0.45)',
                }}>
                  {g} <span style={{ color: 'rgba(255,255,255,0.2)' }}>({count})</span>
                </span>
              );
            })}
          </div>
        </section>

        {/* Coming Soon */}
        <section style={{
          padding: '3rem',
          border: '1px dashed rgba(255,255,255,0.1)',
          borderRadius: '16px',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '0.62rem',
            fontWeight: 400,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.25)',
            marginBottom: '1rem',
          }}>
            Coming Soon
          </p>
          <h4 style={{
            margin: '0 0 1rem',
            fontSize: '1.2rem',
            fontWeight: 300,
          }}>
            Chat, Lore Database, Cross-Universe Guides
          </h4>
          <p style={{
            margin: 0,
            fontSize: '0.85rem',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.3)',
          }}>
            The singularity is still forming. Check back when the event horizon stabilizes.
          </p>
        </section>
      </main>
    </div>
  );
}
