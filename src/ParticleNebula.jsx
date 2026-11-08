// ParticleNebula.jsx
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/* ------------------------------------------------------------------ *
 * Tunables
 * ------------------------------------------------------------------ */
const PARTICLE_COUNT = 6000;
const NEBULA_RADIUS = 4.5;      // wider spread
const SCATTER_RADIUS = 1.15;
const SCATTER_FORCE = 1.5;
const RETURN_SPEED = 2.2;
const SIZE_BOOST = 2.0;         // base particle size multiplier

export default function ParticleNebula({
  position = [0, 0, -2],
  lowQuality = false,
}) {
  const pointsRef = useRef(null);
  const count = lowQuality ? Math.floor(PARTICLE_COUNT * 0.5) : PARTICLE_COUNT;

  const { gl, camera } = useThree();

  const mouseLocal = useRef(new THREE.Vector3(0, 0, 9999));
  const pointerActive = useRef(false);

  const scratch = useMemo(
    () => ({
      world: new THREE.Vector3(),
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -position[2]),
      raycaster: new THREE.Raycaster(),
    }),
    [position]
  );

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const arm = i % 2 === 0 ? 0 : Math.PI;
      const t = Math.pow(Math.random(), 0.65);
      const r = t * NEBULA_RADIUS;
      const spin = t * Math.PI * 1.9;
      const angle = arm + spin + (Math.random() - 0.5) * 0.85;

      const thickness = (1 - t * 0.82) * NEBULA_RADIUS * 0.26;

      positions[i * 3 + 0] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.22;
      positions[i * 3 + 1] =
        (Math.random() + Math.random() + Math.random() - 1.5) * thickness;
      positions[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.22;

      randoms[i] = Math.random();

      // Base size × SIZE_BOOST so the dust actually reads on screen.
      sizes[i] = (0.5 + (1 - t) * 1.6 + Math.random() * 0.5) * SIZE_BOOST;

      const hue = 0.62 + t * 0.28;
      color.setHSL(hue, 0.45 + Math.random() * 0.25, 0.58 + Math.random() * 0.24);
      colors[i * 3 + 0] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(),
      NEBULA_RADIUS + SCATTER_FORCE * 2
    );

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      // Additive makes glowing stardust read against pure black — NormalBlending
      // would darken each particle toward its own color and vanish.
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector3(0, 0, 9999) },
        uMouseActive: { value: 0 },
        uScatterRadius: { value: SCATTER_RADIUS },
        uScatterForce: { value: SCATTER_FORCE },
        uReturnSpeed: { value: RETURN_SPEED },
        uPixelRatio: { value: 1 },
        uScale: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aRandom;
        attribute float aSize;
        attribute vec3 color;

        uniform float uTime;
        uniform vec3  uMouse;
        uniform float uMouseActive;
        uniform float uScatterRadius;
        uniform float uScatterForce;
        uniform float uReturnSpeed;
        uniform float uPixelRatio;
        uniform float uScale;

        varying float vAlpha;
        varying vec3  vColor;

        void main() {
          vColor = color;

          float drift = sin(uTime * 0.55 + aRandom * 6.2831) * 0.055;
          vec3 pos = position + vec3(
            drift * cos(aRandom * 12.0),
            drift * 1.4,
            drift * sin(aRandom * 9.0)
          );

          float scatter = 0.0;
          if (uMouseActive > 0.0) {
            vec3 toParticle = pos - uMouse;
            float dist = length(toParticle);

            float influence = 1.0 - smoothstep(0.0, uScatterRadius, dist);
            influence *= influence;
            scatter = influence;

            if (dist > 0.0001) {
              vec3 dir = toParticle / dist;
              vec3 tangent = normalize(cross(dir, vec3(0.0, 0.0, 1.0)) + 0.0001);
              pos += (dir * 0.85 + tangent * 0.45) *
                     influence * uScatterForce;
            }
          }

          float ramp = smoothstep(0.0, 1.0, min(uTime * uReturnSpeed, 1.0));
          pos = mix(position, pos, ramp);

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

          // Larger base + a gentle swell while scattering, so pushed
          // particles feel like they're reacting rather than just moving.
          float sizeBoost = 1.0 + scatter * 0.6;
          gl_PointSize = aSize * sizeBoost * uScale * uPixelRatio *
                         (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;

          // Brighter at rest, softer when flung outward.
          vAlpha = mix(1.0, 0.45, scatter);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying vec3  vColor;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;

          float falloff = smoothstep(0.5, 0.0, d);
          falloff *= falloff;

          // Hot core → the "glowing stardust" look.
          float core = smoothstep(0.26, 0.0, d);

          // 1.5× color boost on the core, additive-blended on top.
          vec3 rgb = vColor * (1.5 + core * 1.2) + core * 0.35;

          gl_FragColor = vec4(rgb, vAlpha * falloff);
        }
      `,
    });

    return { geometry: geo, material: mat };
  }, [count]);

  useEffect(() => {
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    material.uniforms.uScale.value = 1;
  }, [material, gl]);

  useEffect(() => {
    const el = gl.domElement;

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      scratch.raycaster.setFromCamera({ x: nx, y: ny }, camera);

      const hit = scratch.raycaster.ray.intersectPlane(
        scratch.plane,
        scratch.world
      );

      if (hit) {
        mouseLocal.current.set(
          hit.x - position[0],
          hit.y - position[1],
          hit.z - position[2]
        );
        material.uniforms.uMouse.value.copy(mouseLocal.current);
        pointerActive.current = true;
      }
    };

    const onLeave = () => {
      pointerActive.current = false;
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [gl, camera, material, position, scratch]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    material.uniforms.uTime.value += dt;

    const target = pointerActive.current ? 1 : 0;
    const current = material.uniforms.uMouseActive.value;
    material.uniforms.uMouseActive.value +=
      (target - current) * (1 - Math.exp(-6 * dt));
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      position={position}
      frustumCulled={false}
    />
  );
}
