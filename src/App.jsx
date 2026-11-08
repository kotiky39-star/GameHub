// App.jsx
import { useCallback, useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import Scene from './Scene';
import SplashScreen from './SplashScreen';
import Logo from './Logo';
import Sidebar from './Sidebar';
import SearchBar from './SearchBar';
import UniversePanel from './components/UniversePanel';
import { UNIVERSES, getUniverseById } from './data/universes';
import { useUniverseStore } from './store/useUniverseStore';

export default function App() {
  /* Every post-processing pass pays for these pixels, and the galaxy is
   * thousands of tiny objects where 1.5x mainly magnifies aliasing. */
  const DPR_DEFAULT = 1.25;

  const [dpr, setDpr] = useState(DPR_DEFAULT);
  const [lowQuality, setLowQuality] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  const [isEnterRoute] = useRoute('/enter/:id');
  const enteredId = isEnterRoute ? location.pathname.split('/').pop() : null;

  const selectedUniverse = useUniverseStore((s) => s.selectedUniverse);
  const panelOpen = useUniverseStore((s) => s.panelOpen);
  const closePanel = useUniverseStore((s) => s.closePanel);
  const selectUniverse = useUniverseStore((s) => s.selectUniverse);

  const handlePerformanceDecline = useCallback(() => {
    setLowQuality(true);
    setDpr(1);
  }, []);

  const handlePerformanceIncline = useCallback(() => {
    setLowQuality(false);
    setDpr(1.5);
  }, []);

  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  /* Open universe panel when entering via /enter/:id */
  useEffect(() => {
    if (!splashDone || !enteredId) return;
    const universe = getUniverseById(enteredId);
    if (universe && !selectedUniverse) {
      selectUniverse(enteredId);
    }
  }, [splashDone, enteredId, selectedUniverse, selectUniverse]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#000000',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {/* 3D Canvas */}
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 6, 34], fov: 50, near: 0.1, far: 400 }}
        gl={{
          // The composer owns the final image; MSAA on the default
          // framebuffer would only cost memory and resolve bandwidth.
          antialias: false,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          depth: true,
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <PerformanceMonitor
          bounds={[45, 60]}
          threshold={0.75}
          flipflops={3}
          onDecline={handlePerformanceDecline}
          onIncline={handlePerformanceIncline}
          onFallback={handlePerformanceDecline}
        />

        <Scene lowQuality={lowQuality} />
      </Canvas>

      {/* UI Layer - fades in after splash */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 20,
          pointerEvents: 'none',
          opacity: splashDone ? 1 : 0,
          transition: 'opacity 900ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Top-left: Logo */}
        <div
          style={{
            position: 'fixed',
            top: '2.25rem',
            left: '2.5rem',
            zIndex: 30,
          }}
        >
          <Logo />
        </div>

        {/* Bottom-right: Metadata */}
        <div
          style={{
            position: 'fixed',
            bottom: '2.25rem',
            right: '2.5rem',
            zIndex: 30,
            color: 'rgba(255, 255, 255, 0.3)',
            fontSize: '0.6rem',
            fontWeight: 400,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {UNIVERSES.length} Universes — 2025
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar visible={splashDone} />

      {/* Search Bar */}
      <SearchBar
        onSelect={(universe) => selectUniverse(universe.id)}
        disabled={panelOpen || !splashDone}
      />

      {/* Universe Detail Panel */}
      <UniversePanel
        universe={panelOpen ? selectedUniverse : null}
        onClose={closePanel}
        onEnter={(u) => window.location.assign(`/enter/${u.id}`)}
      />

      {/* Splash Screen */}
      <SplashScreen onDone={handleSplashDone} />
    </div>
  );
}
