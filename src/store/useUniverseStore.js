// src/store/useUniverseStore.js
import { create } from 'zustand';
import { UNIVERSES } from '../data/universes';

/*
 * Single source of truth.
 *
 * Phase machine:
 *   idle       — overview, free orbit, stars clickable
 *   flying     — camera in transit to a star; input locked
 *   focused    — arrived; panel open; orbit locked to the star
 *   returning  — camera in transit back to overview; input locked
 */
export const useUniverseStore = create((set, get) => ({
  selectedId: null,
  selectedUniverse: null,
  phase: 'idle',
  hoveredStarIndex: -1,
  panelOpen: false,
  sidebarOpen: false,

  /* Galaxy → app bridge */
  starPositions: null,
  _cameraCommand: null,

  /* ================= Actions ================= */

  setStarPositions: (map) => set({ starPositions: map }),

  setHoveredStar: (index) => {
    if (get().hoveredStarIndex === index) return;
    set({ hoveredStarIndex: index });
  },

  registerCameraCommand: (fn) => set({ _cameraCommand: fn }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),

  /**
   * Select a universe by id.
   *
   * Called from three places — star onClick, search result, sidebar item —
   * and all three take this identical path. Returns true if a flight began.
   */
  selectUniverse: (id) => {
    const state = get();
    if (!id) return false;
    if (state.phase !== 'idle' && state.phase !== 'focused') return false;

    const universe = UNIVERSES.find((u) => u.id === id) ?? null;
    if (!universe) return false;

    const position = state.starPositions?.get(id) ?? null;

    set({
      selectedId: id,
      selectedUniverse: universe,
      hoveredStarIndex: -1,
      sidebarOpen: false,
    });

    if (position && state._cameraCommand) {
      state._cameraCommand({ type: 'flyTo', position: position.clone() });
      set({ phase: 'flying' });
      return true;
    }

    /* Galaxy still mounting — open the panel without a flight. */
    set({ phase: 'focused', panelOpen: true });
    return false;
  },

  handleFlightComplete: () => {
    set({ phase: 'focused', panelOpen: true });
  },

  closePanel: () => {
    const state = get();
    set({ panelOpen: false, selectedId: null, selectedUniverse: null });

    if (state._cameraCommand && state.phase === 'focused') {
      state._cameraCommand({ type: 'flyToOverview' });
      set({ phase: 'returning' });
    } else {
      set({ phase: 'idle' });
    }
  },

  handleReturnComplete: () => {
    set({ phase: 'idle', hoveredStarIndex: -1 });
  },
}));
