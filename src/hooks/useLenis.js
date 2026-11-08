import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Lenis from 'lenis';

/**
 * Advances Lenis from the R3F render loop.
 *
 * This keeps:
 * - Lenis scroll updates
 * - camera animation
 * - WebGL rendering
 *
 * synchronized to the same animation cycle.
 */
export function useLenis() {
  const lenisRef = useRef(null);
  const scroll = useRef(0);

  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: true,
      lerp: 0.1,
    });

    lenisRef.current = lenis;
    scroll.current = lenis.scroll || 0;

    const handleScroll = ({ scroll: currentScroll }) => {
      scroll.current = currentScroll;
    };

    lenis.on('scroll', handleScroll);

    return () => {
      lenis.off('scroll', handleScroll);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useFrame(({ clock }) => {
    if (!lenisRef.current) return;

    // Lenis expects milliseconds.
    lenisRef.current.raf(clock.getElapsedTime() * 1000);
  });

  return {
    lenis: lenisRef,
    scroll,
  };
}
