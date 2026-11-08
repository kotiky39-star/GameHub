// SplashScreen.jsx
import { useEffect, useState } from 'react';

export default function SplashScreen({ onDone }) {
  const [lineWidth, setLineWidth] = useState('0%');
  const [fading, setFading] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    // Kick animation on next frame to ensure transition fires
    const raf = requestAnimationFrame(() => {
      setLineWidth('100%');
    });

    // Begin fade at 2s
    const fadeTimer = setTimeout(() => setFading(true), 2000);

    // Unmount after fade completes
    const unmountTimer = setTimeout(() => {
      setMounted(false);
      onDone?.();
    }, 2600);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, [onDone]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2.75rem',
        background: '#000000',
        pointerEvents: fading ? 'none' : 'auto',
        opacity: fading ? 0 : 1,
        transition: 'opacity 600ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div
        style={{
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontSize: 'clamp(2rem, 7vw, 5rem)',
          fontWeight: 300,
          letterSpacing: '0.5em',
          textTransform: 'uppercase',
          color: '#ffffff',
          textIndent: '0.5em',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        Nexus
      </div>

      <div
        aria-hidden="true"
        style={{
          width: 'min(520px, 60vw)',
          height: 1,
          background: 'rgba(255, 255, 255, 0.14)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: lineWidth,
            background: '#ffffff',
            transition: 'width 1500ms cubic-bezier(0.65, 0, 0.35, 1)',
          }}
        />
      </div>
    </div>
  );
}
