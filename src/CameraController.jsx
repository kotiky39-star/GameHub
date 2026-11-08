// CameraController.jsx
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useUniverseStore } from './store/useUniverseStore';

/* ------------------------------------------------------------------ *
 * Tunables
 * ------------------------------------------------------------------ */
const INITIAL_DISTANCE = 34;
const LMB_SENSITIVITY = 0.0055;
const RMB_SENSITIVITY = 0.0038;
const DRAG_EASE = 3.4;
const DRAG_DAMPING = 0.86;

const FLY_DURATION = 2.0;
const RETURN_DURATION = 1.8;

/*
 * Arrival offset from the selected star. This is a WORLD-SPACE offset, not a
 * radial one, so the framing is identical for every star and no pivot
 * computation is involved during the flight.
 */
const FLY_OFFSET = new THREE.Vector3(0, 5, 15);

const ZOOM_SENSITIVITY = 0.025;
const ZOOM_MIN = 8;
const ZOOM_MAX = 60;

/* ------------------------------------------------------------------ *
 * CameraController
 * ------------------------------------------------------------------ *
 * Modes: 'overview' | 'focusing' | 'focused' | 'returning'
 *
 * The pivot is never mutated mid-flight. During a flight we lerp
 * camera.position and a lookAt target. Only on arrival do we commit the
 * pivot to the star, so post-flight orbit rotates around what we're
 * actually looking at.
 * ------------------------------------------------------------------ */
export default function CameraController() {
  const { camera, gl } = useThree();

  const registerCameraCommand = useUniverseStore(
    (s) => s.registerCameraCommand
  );
  const handleFlightComplete = useUniverseStore((s) => s.handleFlightComplete);
  const handleReturnComplete = useUniverseStore((s) => s.handleReturnComplete);

  /* Orbit pivot — the point the overview camera rotates around. */
  const pivot = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  const target = useMemo(
    () => ({ yaw: 0, pitch: 0.18, distance: INITIAL_DISTANCE }),
    []
  );
  const current = useMemo(
    () => ({ yaw: 0, pitch: 0.18, distance: INITIAL_DISTANCE }),
    []
  );

  const velocity = useRef({ yaw: 0, pitch: 0 });

  const mode = useRef('overview');
  const flyElapsed = useRef(0);

  const drag = useRef({
    active: false,
    button: -1,
    lastX: 0,
    lastY: 0,
    pointerId: -1,
  });

  const scratch = useMemo(
    () => ({
      flyStartPos: new THREE.Vector3(),
      flyEndPos: new THREE.Vector3(),
      flyStartLook: new THREE.Vector3(),
      flyEndLook: new THREE.Vector3(),
      lookTarget: new THREE.Vector3(),
      focusTarget: new THREE.Vector3(),
      returnStartPos: new THREE.Vector3(),
      returnEndPos: new THREE.Vector3(),
      returnStartLook: new THREE.Vector3(),
      returnEndLook: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      returnYaw: 0,
      returnPitch: 0.18,
    }),
    []
  );

  /* ---- Store subscription: camera commands ---- */
  useEffect(() => {
    const handleCommand = (command) => {
      if (command.type === 'flyTo') {
        if (mode.current === 'focusing' || mode.current === 'returning') return;

        /*
         * Snapshot the CURRENT camera state as the flight origin. This is
         * read from the live camera, not from orbit angles, so a flight
         * started mid-orbit begins exactly where the camera is.
         */
        scratch.flyStartPos.copy(camera.position);
        scratch.flyStartLook.copy(scratch.lookTarget);

        /*
         * Arrival pose: star position + fixed world offset. No radial
         * normalization, no pivot math — that was the source of the
         * end-of-flight snap.
         */
        scratch.focusTarget.copy(command.position);
        scratch.flyEndPos.copy(command.position).add(FLY_OFFSET);
        scratch.flyEndLook.copy(command.position);

        flyElapsed.current = 0;
        mode.current = 'focusing';
      }

      if (command.type === 'flyToOverview') {
        if (mode.current === 'returning') return;

        scratch.returnStartPos.copy(camera.position);
        scratch.returnStartLook.copy(scratch.lookTarget);

        scratch.returnYaw = current.yaw;
        scratch.returnPitch = current.pitch;

        const cosPitch = Math.cos(scratch.returnPitch);
        scratch.returnEndPos.set(
          Math.sin(scratch.returnYaw) * cosPitch * INITIAL_DISTANCE,
          Math.sin(scratch.returnPitch) * INITIAL_DISTANCE,
          Math.cos(scratch.returnYaw) * cosPitch * INITIAL_DISTANCE
        );
        scratch.returnEndLook.set(0, 0, 0);

        flyElapsed.current = 0;
        mode.current = 'returning';
      }
    };

    registerCameraCommand(handleCommand);
    return () => registerCameraCommand(null);
  }, [registerCameraCommand, camera, current, scratch]);

  /* ---- Input wiring ---- */
  useEffect(() => {
    const el = gl.domElement;

    const onWheel = (e) => {
      e.preventDefault();
      if (mode.current === 'focusing' || mode.current === 'returning') return;

      const modeScale =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
      const step = THREE.MathUtils.clamp(
        e.deltaY * modeScale * ZOOM_SENSITIVITY,
        -4,
        4
      );

      target.distance = THREE.MathUtils.clamp(
        target.distance + step,
        ZOOM_MIN,
        ZOOM_MAX
      );
    };

    const onGesture = (e) => e.preventDefault();
    const onContextMenu = (e) => e.preventDefault();

    const onPointerDown = (e) => {
      if (mode.current === 'focusing' || mode.current === 'returning') return;
      if (e.button !== 0 && e.button !== 2) return;

      drag.current.active = true;
      drag.current.button = e.button;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      drag.current.pointerId = e.pointerId;

      velocity.current.yaw = 0;
      velocity.current.pitch = 0;

      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* already captured */
      }

      el.__isDragging = true;
    };

    const onPointerMove = (e) => {
      if (!drag.current.active) return;
      if (mode.current === 'focusing' || mode.current === 'returning') return;
      if (
        drag.current.pointerId !== -1 &&
        e.pointerId !== drag.current.pointerId
      ) {
        return;
      }

      const dx = e.clientX - drag.current.lastX;
      const dy = e.clientY - drag.current.lastY;

      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;

      if (drag.current.button === 0) {
        const delta = -dx * LMB_SENSITIVITY;
        target.yaw += delta;
        velocity.current.yaw = delta;
      } else if (drag.current.button === 2) {
        const delta = -dy * RMB_SENSITIVITY;
        target.pitch = THREE.MathUtils.clamp(target.pitch + delta, -1.2, 1.2);
        velocity.current.pitch = delta;
      }
    };

    const endDrag = (e) => {
      if (!drag.current.active) return;
      drag.current.active = false;
      drag.current.button = -1;

      if (e && e.pointerId !== undefined) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      }
      drag.current.pointerId = -1;
      el.__isDragging = false;
    };

    const onBlur = () => {
      if (drag.current.active) endDrag(null);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('lostpointercapture', endDrag);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGesture);
    el.addEventListener('gesturechange', onGesture);
    el.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('lostpointercapture', endDrag);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGesture);
      el.removeEventListener('gesturechange', onGesture);
      el.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
      el.__isDragging = false;
    };
  }, [gl, target]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    /* ================= forward flight ================= */
    if (mode.current === 'focusing') {
      flyElapsed.current += dt;
      const raw = Math.min(flyElapsed.current / FLY_DURATION, 1);
      const t =
        raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;

      /*
       * Both position and look target lerp together. The pivot is NOT
       * touched here — that's what eliminates the end-of-flight snap.
       */
      camera.position.copy(scratch.flyStartPos).lerp(scratch.flyEndPos, t);
      scratch.lookTarget
        .copy(scratch.flyStartLook)
        .lerp(scratch.flyEndLook, t);

      camera.up.set(0, 1, 0);
      camera.lookAt(scratch.lookTarget);

      if (raw >= 1) {
        mode.current = 'focused';

        /* Commit the pivot exactly once, at arrival. */
        pivot.copy(scratch.focusTarget);

        /* Derive orbit angles from the actual arrival pose. */
        const offset = scratch.offset
          .copy(camera.position)
          .sub(scratch.focusTarget);
        const radius = offset.length();

        target.distance = radius;
        current.distance = radius;

        const yaw = Math.atan2(offset.x, offset.z);
        const pitch = Math.asin(
          THREE.MathUtils.clamp(offset.y / Math.max(radius, 1e-6), -1, 1)
        );

        target.yaw = yaw;
        target.pitch = pitch;
        current.yaw = yaw;
        current.pitch = pitch;

        velocity.current.yaw = 0;
        velocity.current.pitch = 0;

        handleFlightComplete();
      }
      return;
    }

    /* ================= reverse flight ================= */
    if (mode.current === 'returning') {
      flyElapsed.current += dt;
      const raw = Math.min(flyElapsed.current / RETURN_DURATION, 1);
      const t = 1 - Math.pow(1 - raw, 3);

      camera.position.copy(scratch.returnStartPos).lerp(scratch.returnEndPos, t);
      scratch.lookTarget
        .copy(scratch.returnStartLook)
        .lerp(scratch.returnEndLook, t);

      camera.up.set(0, 1, 0);
      camera.lookAt(scratch.lookTarget);

      if (raw >= 1) {
        mode.current = 'overview';

        pivot.set(0, 0, 0);

        target.yaw = scratch.returnYaw;
        target.pitch = scratch.returnPitch;
        target.distance = INITIAL_DISTANCE;
        current.yaw = scratch.returnYaw;
        current.pitch = scratch.returnPitch;
        current.distance = INITIAL_DISTANCE;

        velocity.current.yaw = 0;
        velocity.current.pitch = 0;

        handleReturnComplete();
      }
      return;
    }

    /* ================= momentum ================= */
    if (!drag.current.active) {
      const decay = Math.pow(DRAG_DAMPING, dt * 60);
      velocity.current.yaw *= decay;
      velocity.current.pitch *= decay;
      if (Math.abs(velocity.current.yaw) < 1e-5) velocity.current.yaw = 0;
      if (Math.abs(velocity.current.pitch) < 1e-5) velocity.current.pitch = 0;

      target.yaw += velocity.current.yaw;
      target.pitch = THREE.MathUtils.clamp(
        target.pitch + velocity.current.pitch,
        -1.2,
        1.2
      );
    }

    /* ================= smoothing ================= */
    const ease = 1 - Math.exp(-DRAG_EASE * dt);
    current.yaw += (target.yaw - current.yaw) * ease;
    current.pitch += (target.pitch - current.pitch) * ease;
    current.distance += (target.distance - current.distance) * ease;

    /* ================= focused ================= */
    if (mode.current === 'focused') {
      const radius = current.distance;
      const yaw = THREE.MathUtils.clamp(current.yaw, -0.9, 0.9);
      const pitch = THREE.MathUtils.clamp(current.pitch, -0.55, 0.75);
      const cosPitch = Math.cos(pitch);

      camera.position.set(
        pivot.x + Math.sin(yaw) * cosPitch * radius,
        pivot.y + Math.sin(pitch) * radius,
        pivot.z + Math.cos(yaw) * cosPitch * radius
      );
      camera.lookAt(pivot);
      return;
    }

    /* ================= overview ================= */
    const cosPitch = Math.cos(current.pitch);
    camera.position.set(
      pivot.x + Math.sin(current.yaw) * cosPitch * current.distance,
      pivot.y + Math.sin(current.pitch) * current.distance,
      pivot.z + Math.cos(current.yaw) * cosPitch * current.distance
    );
    camera.lookAt(pivot);
    scratch.lookTarget.copy(pivot);
  });

  return null;
}

export { INITIAL_DISTANCE, FLY_OFFSET };
