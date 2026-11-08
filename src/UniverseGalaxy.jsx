// UniverseGalaxy.jsx
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { UNIVERSES, getUniverseById } from './data/universes';
import { useUniverseStore } from './store/useUniverseStore';

/* ------------------------------------------------------------------ *
 * Tunables
 * ------------------------------------------------------------------ */
const GALAXY_RADIUS = 28;
const GALAXY_THICKNESS = 2.0;
const CORE_DENSITY_FALLOFF = 0.55;

const BH_RADIUS = 1.2;
const BH_INNER_RADIUS = BH_RADIUS + 3.0;
const BH_ORBIT_STRENGTH = 3.0;

const STAR_RADIUS = 0.055;
const HIT_PIXELS = 10;
const HOVER_SCALE = 1.6;
const SELECT_SCALE = 2.2;
const LERP_HOVER = 10;
const LERP_SELECT = 6;
const CLICK_PIXEL_THRESHOLD = 5;

const UNIVERSE_HUE = 0.08;
const UNIVERSE_SCALE_BOOST = 1.5;

/* Radial terrain displacement as a fraction of the planet radius. */
const TERRAIN_REL = 0.2;
/* Blend of the faceted derivative normal back towards the smooth sphere
 * normal (0 = fully faceted, 1 = terrain shading disappears). */
const NORMAL_MIX = 0.3;

const RING_COVERAGE = 0.3;
const RING_INNER = STAR_RADIUS * 1.35;
const RING_OUTER = STAR_RADIUS * 2.35;
const RING_DUST_COLOR = 0xc9b48a;

/* ------------------------------------------------------------------ *
 * Quality tiers
 * ------------------------------------------------------------------ *
 * The whole galaxy is drawn by two instanced draws, so the per-frame cost
 * is `count * sphereTris` vertices with two noise taps each. Segments are
 * therefore the dominant knob: 20 segments is 441 vertices and 760
 * triangles per planet, 48 was 2401 and 4608 — a 5.4x difference.
 *
 * Planets are 3-20 pixels wide on screen, which is what makes the low
 * segment counts free visually.
 * ------------------------------------------------------------------ */
const QUALITY_TIERS = {
  high: { count: 5500, segments: 20, ringSegments: 32 },
  medium: { count: 4200, segments: 16, ringSegments: 28 },
  low: { count: 2400, segments: 12, ringSegments: 20 },
};

function detectTier(lowQuality) {
  let tier = 'high';

  if (typeof window !== 'undefined') {
    const forced = new URLSearchParams(window.location.search).get('quality');
    if (forced && QUALITY_TIERS[forced]) {
      tier = forced;
    } else {
      const cores = navigator.hardwareConcurrency || 4;
      if (cores <= 4 || (window.devicePixelRatio || 1) > 2) tier = 'medium';
    }
  } else {
    tier = 'medium';
  }

  /* PerformanceMonitor-driven downgrade (see App.jsx). */
  if (lowQuality) tier = tier === 'high' ? 'medium' : 'low';

  return tier;
}

/* ------------------------------------------------------------------ *
 * GLSL — shared helpers
 * ------------------------------------------------------------------ *
 * `position` and `normal` are injected by three for every non-raw
 * ShaderMaterial and must NOT be re-declared. Instancing here comes from
 * InstancedBufferGeometry, so there is no `instanceMatrix` to consume —
 * orbital motion is computed from `aOrbit` instead (see below).
 * ------------------------------------------------------------------ */
const GLSL_COMMON = /* glsl */ `
  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  // Simplex 3D noise (Ashima / Gustavson), range roughly [-1, 1].
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`;

/* ------------------------------------------------------------------ *
 * GLSL — planets
 * ------------------------------------------------------------------ *
 * Vertex budget rule used here: a planet covers a handful of pixels, so
 * the vertex stage only carries the two noise taps that actually move
 * geometry, while craters and banding — which are pure shading — run per
 * fragment. Moving those to the vertex stage multiplied the cost by the
 * vertex/pixel ratio for free-looking detail.
 * ------------------------------------------------------------------ */
const PLANET_VERTEX = /* glsl */ `
  attribute vec4 aOrbit;   // x radius, y height, z phase, w angular velocity
  attribute float aSeed;
  attribute float aScale;
  attribute float aOverride;

  uniform float uTime;
  uniform float uTerrainRel;

  varying vec3 vWorldPos;
  varying vec3 vRefNormal;
  varying vec3 vSurfaceDir;
  /* x = terrain elevation, y = seed, z = universe tint override */
  varying vec4 vShade;

  ${GLSL_COMMON}

  float terrainHeight(vec3 dir, float seed) {
    vec3 p =
      dir * (1.2 + hash11(seed + 11.0) * 2.0) +
      vec3(seed, seed * 0.5, seed * 0.25);
    float continents = snoise(p);
    float ridged = 1.0 - abs(snoise(p * 2.1 + 5.3));
    return continents * 0.62 + (ridged - 0.5) * 0.46;
  }

  void main() {
    float seed = aSeed;

    /* Orbit solved analytically on the GPU: Keplerian angle from the
     * simulated clock, so the CPU never touches 5500 matrices a frame. */
    float angle = aOrbit.z + aOrbit.w * uTime;
    vec3 orbit = vec3(cos(angle) * aOrbit.x, aOrbit.y, sin(angle) * aOrbit.x);

    /* Axial spin, per planet rate — driven by the same clock, so hovering
     * dilates terrain motion along with the orbit. */
    float spin = uTime * (0.05 + hash11(seed + 3.0) * 0.2) + seed * 6.2831;
    float cs = cos(spin);
    float sn = sin(spin);
    vec3 lp = vec3(
      cs * position.x + sn * position.z,
      position.y,
      -sn * position.x + cs * position.z
    );
    vec3 ln = vec3(
      cs * normal.x + sn * normal.z,
      normal.y,
      -sn * normal.x + cs * normal.z
    );

    vec3 dir = normalize(lp);
    float h = terrainHeight(dir, seed);

    /* Sphere normals are radial, so "displace along the normal" is a radial
     * scale: no STAR_RADIUS in the shader, no per-vertex normal rework. */
    vec3 world = orbit + lp * (1.0 + h * uTerrainRel) * aScale;

    vWorldPos = (modelMatrix * vec4(world, 1.0)).xyz;
    vRefNormal = normalize(mat3(modelMatrix) * ln);
    vSurfaceDir = dir;
    vShade = vec4(h, seed, aOverride, 0.0);

    gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
  }
`;

const PLANET_FRAGMENT = /* glsl */ `
  uniform float uDim;
  uniform vec3 uCorePos;
  uniform vec3 uUniverseTint;
  uniform float uNormalMix;

  varying vec3 vWorldPos;
  varying vec3 vRefNormal;
  varying vec3 vSurfaceDir;
  varying vec4 vShade;

  ${GLSL_COMMON}

  void main() {
    float seed = vShade.y;
    vec3 P = vWorldPos;
    vec3 dir = normalize(vSurfaceDir);

    /* ---- two-tone palette, derived from the seed ---- */
    float hue = hash11(seed * 1.37 + 4.0);
    float sat = 0.18 + hash11(seed + 12.0) * 0.52;
    float val = 0.42 + hash11(seed + 21.0) * 0.42;

    vec3 cA = hsv2rgb(vec3(hue, sat, val));
    vec3 cB = hsv2rgb(vec3(
      fract(hue + 0.08 + hash11(seed + 31.0) * 0.42),
      clamp(sat * 0.85, 0.0, 0.9),
      min(val + 0.36, 1.0)
    ));

    /* ---- per-pixel detail: impact basins with raised rims + banding ---- */
    float cfq = 6.0 + hash11(seed + 41.0) * 6.0;
    float q = snoise(dir * cfq + vec3(seed * 1.7, seed * 0.7, seed * 0.3));
    float bowl = smoothstep(0.62, 0.94, q);
    float rim = smoothstep(0.42, 0.62, q) * (1.0 - bowl);
    float craters = rim * 0.6 - bowl * 0.55;

    float bands =
      snoise(dir * (3.0 + hash11(seed + 51.0) * 5.0) + vec3(seed * 0.37));
    float m =
      clamp(vShade.x * 1.5 + bands * 0.4 + craters * 0.7 + 0.25, 0.0, 1.0);

    vec3 albedo = mix(cA, cB, m);

    /* Ice caps on roughly half of the planets. */
    float icy = step(0.55, hash11(seed + 61.0));
    albedo = mix(
      albedo,
      vec3(0.88, 0.92, 1.0) * (val + 0.2),
      smoothstep(0.78, 0.96, abs(dir.y)) * icy
    );

    /* Universe stars keep the terrain but wear the house gold. */
    albedo = mix(albedo, uUniverseTint * (0.7 + 0.6 * m), vShade.z);

    /* Perceptual -> linear. pow(albedo, 2.2) costs three transcendentals per
     * pixel; the square is visually indistinguishable at this scale. */
    albedo *= albedo;

    /* ---- lighting: the accretion core at the galactic centre ---- */
    vec3 toCore = uCorePos - P;
    float dist = length(toCore);
    vec3 L = toCore / max(dist, 1e-4);
    vec3 V = normalize(cameraPosition - P);

    /* Faceted normal from screen-space derivatives: terrain shading without
     * finite-difference noise taps in the vertex stage. */
    vec3 flatN = normalize(cross(dFdx(P), dFdy(P)));
    if (dot(flatN, vRefNormal) < 0.0) flatN = -flatN;
    vec3 N = normalize(mix(flatN, normalize(vRefNormal), uNormalMix));

    float diff = smoothstep(-0.2, 0.45, dot(N, L));
    float atten = mix(1.2, 0.62, smoothstep(4.2, 28.0, dist));
    /* Basins read darker than peaks — cheap self-shadowing. */
    float ao = clamp(0.7 + vShade.x * 0.7 + craters * 0.5, 0.32, 1.18);

    vec3 lit = albedo * (diff * ao * atten + 0.1 * atten);

    float rough = hash11(seed + 71.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), mix(14.0, 90.0, rough));
    lit += vec3(1.0, 0.93, 0.8) * spec * mix(0.02, 0.5, rough * rough) * atten * diff;

    float atmo = step(0.5, hash11(seed + 81.0));
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.5);
    lit += cB * fres * atmo * 0.5 * atten * (0.35 + 0.65 * diff);

    gl_FragColor = vec4(lit * mix(1.0, 0.22, uDim), 1.0);
  }
`;

/* ------------------------------------------------------------------ *
 * GLSL — Saturn-like rings
 * ------------------------------------------------------------------ *
 * Only planets that actually own a ring get an instance here, so there is
 * no aHasRing to switch off on the GPU: the ~70% without rings never
 * reach the vertex shader at all.
 * ------------------------------------------------------------------ */
const RING_VERTEX = /* glsl */ `
  attribute vec4 aOrbit;
  attribute float aSeed;
  attribute float aScale;

  uniform float uTime;
  uniform float uRingInner;
  uniform float uRingOuter;
  uniform float uRadiusUnit;

  varying vec3 vWorldPos;
  varying vec3 vRingNormal;
  varying vec3 vCenter;
  varying float vRadial;
  varying float vPlanetRadius;
  varying float vSeed;

  ${GLSL_COMMON}

  void main() {
    float angle = aOrbit.z + aOrbit.w * uTime;
    vec3 orbit = vec3(cos(angle) * aOrbit.x, aOrbit.y, sin(angle) * aOrbit.x);

    float r = length(position.xy);
    vRadial = (r - uRingInner) / max(uRingOuter - uRingInner, 1e-5);

    /* Random ring plane: tilt off the galactic plane + node angle. The tilt
     * floor keeps cross(up, n) away from zero. */
    float tilt = mix(0.08, 1.2, hash11(aSeed + 2.0));
    float psi = hash11(aSeed + 3.0) * 6.2831;
    vec3 n = vec3(sin(tilt) * cos(psi), cos(tilt), sin(tilt) * sin(psi));
    vec3 u = normalize(cross(vec3(0.0, 1.0, 0.0), n));
    vec3 w = cross(n, u);

    vec3 world = orbit + (u * position.x + w * position.y) * aScale;

    vWorldPos = (modelMatrix * vec4(world, 1.0)).xyz;
    vRingNormal = normalize(mat3(modelMatrix) * n);
    vCenter = (modelMatrix * vec4(orbit, 1.0)).xyz;
    vPlanetRadius = aScale * uRadiusUnit;
    vSeed = aSeed;

    gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
  }
`;

const RING_FRAGMENT = /* glsl */ `
  uniform float uDim;
  uniform vec3 uCorePos;
  uniform vec3 uDustColor;

  varying vec3 vWorldPos;
  varying vec3 vRingNormal;
  varying vec3 vCenter;
  varying float vRadial;
  varying float vPlanetRadius;
  varying float vSeed;

  ${GLSL_COMMON}

  void main() {
    vec3 P = vWorldPos;
    vec3 N = normalize(vRingNormal);
    vec3 V = normalize(cameraPosition - P);

    vec3 toCore = uCorePos - P;
    float dist = length(toCore);
    vec3 L = toCore / max(dist, 1e-4);
    float atten = mix(1.2, 0.62, smoothstep(4.2, 28.0, dist));

    /* Planet shadow cast onto the ring plane. */
    vec3 oc = vCenter - P;
    float along = dot(oc, L);
    float perp = length(oc - L * max(along, 0.0));
    float shadow = 1.0;
    if (along > 0.0) {
      shadow = mix(
        0.1,
        1.0,
        smoothstep(vPlanetRadius * 0.75, vPlanetRadius * 1.3, perp)
      );
    }

    /* Cassini-like banding, seeded so every ring system differs. */
    float x = clamp(vRadial, 0.0, 1.0);
    float wobble = snoise(vec3(x * 18.0, vSeed * 3.0, 0.0));
    float bands =
      0.55 + 0.45 * sin(x * 34.0 + hash11(vSeed + 8.0) * 6.2831 + wobble * 1.6);
    float density = clamp(bands * 0.7 + wobble * 0.45, 0.0, 1.0);
    density *= smoothstep(0.0, 0.07, x) * (1.0 - smoothstep(0.88, 1.0, x));

    /* Forward scattering: dusty rings flare when viewed edge-on. */
    float facing = 1.0 - abs(dot(N, V));
    float illum = 0.35 + 0.65 * abs(dot(N, L));

    vec3 col =
      uDustColor * density * shadow * illum * atten *
      (0.35 + 0.85 * facing) * mix(1.0, 0.22, uDim);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ------------------------------------------------------------------ *
 * Galaxy layout
 * ------------------------------------------------------------------ *
 * Stars orbit the black hole with Keplerian angular velocity
 *   ω = BH_ORBIT_STRENGTH / r^1.5
 * and the whole orbit is a closed form, which is what lets the vertex
 * shader resolve positions from `uTime` alone.
 *
 * The 99 universe stars sit at fixed radial slots ordered by rank (index
 * in UNIVERSES); rank 0 is closest to the singularity.
 * ------------------------------------------------------------------ */

/* Deterministic per-index hash, so planets look identical across reloads,
 * StrictMode double-invocation and HMR passes. */
function hashSeed(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildGalaxy(count) {
  const orbit = new Float32Array(count * 4);
  const scales = new Float32Array(count);
  const seeds = new Float32Array(count);
  const hasRings = new Float32Array(count);

  const rRange = GALAXY_RADIUS - BH_INNER_RADIUS;

  for (let i = 0; i < count; i++) {
    const t = Math.pow(Math.random(), CORE_DENSITY_FALLOFF);
    const r = BH_INNER_RADIUS + t * rRange;
    const phase = Math.random() * Math.PI * 2;

    const thickness = GALAXY_THICKNESS * (1 - t * 0.7);
    const y =
      (Math.random() + Math.random() + Math.random() - 1.5) * thickness * 0.5;

    orbit[i * 4 + 0] = r;
    orbit[i * 4 + 1] = y;
    orbit[i * 4 + 2] = phase;
    orbit[i * 4 + 3] = BH_ORBIT_STRENGTH / Math.pow(r, 1.5);

    scales[i] = 0.7 + (1 - t) * 0.8 + Math.random() * 0.35;
    seeds[i] = hashSeed(i + 1) * 97.3 + 0.5;
    hasRings[i] = hashSeed(i + 977) < RING_COVERAGE ? 1 : 0;
  }

  return {
    orbit,
    scales,
    /* Pristine copy — the universe-star boost rewrites `scales` from this. */
    baseScales: scales.slice(),
    seeds,
    hasRings,
  };
}

/* Same closed form as the vertex shader, for picking and for the camera. */
function orbitPos(orbit, i, t, out) {
  const angle = orbit[i * 4 + 2] + orbit[i * 4 + 3] * t;
  return out.set(
    Math.cos(angle) * orbit[i * 4],
    orbit[i * 4 + 1],
    Math.sin(angle) * orbit[i * 4]
  );
}

function buildStarBindings(count) {
  const indexById = new Map();
  const idByIndex = new Map();

  const rRange = GALAXY_RADIUS - BH_INNER_RADIUS;
  const N = UNIVERSES.length;

  UNIVERSES.forEach((u, i) => {
    const t = i / N;
    const r = BH_INNER_RADIUS + Math.pow(t, 0.8) * rRange;
    const densityT = (r - BH_INNER_RADIUS) / rRange;
    const idx = Math.min(
      Math.floor(Math.pow(densityT, 1 / CORE_DENSITY_FALLOFF) * count),
      count - 1
    );
    indexById.set(u.id, idx);
    if (!idByIndex.has(idx)) idByIndex.set(idx, u.id);
  });

  return { indexById, idByIndex };
}

/* ------------------------------------------------------------------ *
 * Imperative tooltip node
 * ------------------------------------------------------------------ */
function useTooltip() {
  const nodeRef = useRef(null);

  useEffect(() => {
    const node = document.createElement('div');
    Object.assign(node.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      padding: '0.4rem 0.7rem',
      borderRadius: '8px',
      background: 'rgba(10, 14, 30, 0.86)',
      border: '1px solid rgba(160, 185, 255, 0.42)',
      color: '#eaf0ff',
      font: '500 12px/1.4 Inter, system-ui, sans-serif',
      letterSpacing: '0.03em',
      pointerEvents: 'none',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      boxShadow: '0 6px 24px rgba(0,0,0,0.55)',
      transform: 'translate(-50%, -145%)',
      transition: 'opacity 140ms ease',
      opacity: '0',
      zIndex: 45,
      whiteSpace: 'nowrap',
    });
    document.body.appendChild(node);
    nodeRef.current = node;
    return () => {
      node.remove();
      nodeRef.current = null;
    };
  }, []);

  return nodeRef;
}

/* ------------------------------------------------------------------ *
 * UniverseGalaxy
 * ------------------------------------------------------------------ */
export default function UniverseGalaxy({ lowQuality = false }) {
  const tooltipRef = useTooltip();
  const { gl, camera } = useThree();

  const selectedId = useUniverseStore((s) => s.selectedId);
  const phase = useUniverseStore((s) => s.phase);
  const setHoveredStar = useUniverseStore((s) => s.setHoveredStar);
  const setStarPositions = useUniverseStore((s) => s.setStarPositions);

  const dimmed = phase === 'focused' ? 1 : 0;

  /** Planet indices whose scale is still easing towards a target. */
  const animRef = useRef(new Set());
  const prevSelectedRef = useRef(-1);

  const tier = useMemo(
    () => QUALITY_TIERS[detectTier(lowQuality)],
    [lowQuality]
  );
  const { count, segments, ringSegments } = tier;

  const data = useMemo(() => buildGalaxy(count), [count]);
  const bindings = useMemo(() => buildStarBindings(count), [count]);

  const selectedIndex = useMemo(
    () => (selectedId ? bindings.indexById.get(selectedId) ?? -1 : -1),
    [selectedId, bindings]
  );

  /* Ring owners get their own compact instance range. */
  const ringData = useMemo(() => {
    const owners = [];
    for (let i = 0; i < count; i++) if (data.hasRings[i]) owners.push(i);

    const n = owners.length;
    const orbit = new Float32Array(n * 4);
    const seeds = new Float32Array(n);
    const scales = new Float32Array(n);

    for (let k = 0; k < n; k++) {
      const i = owners[k];
      orbit[k * 4 + 0] = data.orbit[i * 4 + 0];
      orbit[k * 4 + 1] = data.orbit[i * 4 + 1];
      orbit[k * 4 + 2] = data.orbit[i * 4 + 2];
      orbit[k * 4 + 3] = data.orbit[i * 4 + 3];
      seeds[k] = data.seeds[i];
      scales[k] = data.scales[i];
    }

    /* planet index -> ring instance index, for the hover/select lerp */
    const byPlanet = new Map();
    for (let k = 0; k < n; k++) byPlanet.set(owners[k], k);

    return { count: n, orbit, seeds, scales, byPlanet };
  }, [data, count]);

  /* ---- Planet geometry ----
   * InstancedBufferGeometry rather than InstancedMesh: nothing consumes
   * `instanceMatrix` any more, so the per-instance matrix buffer
   * (count * 256 bytes, re-uploaded every frame before) is gone entirely.
   * The sphere attributes are borrowed from a donor geometry that is never
   * disposed — its attributes are the ones the renderer uploads.
   */
  const geometry = useMemo(() => {
    const donor = new THREE.SphereGeometry(STAR_RADIUS, segments, segments);
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex(donor.getIndex());
    g.setAttribute('position', donor.getAttribute('position'));
    g.setAttribute('normal', donor.getAttribute('normal'));

    g.setAttribute(
      'aOrbit',
      new THREE.InstancedBufferAttribute(data.orbit.slice(), 4)
    );
    g.setAttribute(
      'aSeed',
      new THREE.InstancedBufferAttribute(data.seeds.slice(), 1)
    );
    g.setAttribute(
      'aScale',
      new THREE.InstancedBufferAttribute(data.scales.slice(), 1)
    );
    g.setAttribute(
      'aOverride',
      new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    );
    g.instanceCount = count;
    return g;
  }, [data, count, segments]);

  /* ---- Ring geometry ---- */
  const ringGeometry = useMemo(() => {
    if (ringData.count === 0) return null;

    const donor = new THREE.RingGeometry(
      RING_INNER,
      RING_OUTER,
      ringSegments,
      1
    );
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex(donor.getIndex());
    g.setAttribute('position', donor.getAttribute('position'));
    g.setAttribute('normal', donor.getAttribute('normal'));

    g.setAttribute(
      'aOrbit',
      new THREE.InstancedBufferAttribute(ringData.orbit.slice(), 4)
    );
    g.setAttribute(
      'aSeed',
      new THREE.InstancedBufferAttribute(ringData.seeds.slice(), 1)
    );
    g.setAttribute(
      'aScale',
      new THREE.InstancedBufferAttribute(ringData.scales.slice(), 1)
    );
    g.instanceCount = ringData.count;
    return g;
  }, [ringData, ringSegments]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDim: { value: 0 },
          uTerrainRel: { value: TERRAIN_REL },
          uNormalMix: { value: NORMAL_MIX },
          uCorePos: { value: new THREE.Vector3(0, 0, 0) },
          uUniverseTint: { value: new THREE.Color().setHSL(UNIVERSE_HUE, 0.85, 0.62) },
        },
        vertexShader: PLANET_VERTEX,
        fragmentShader: PLANET_FRAGMENT,
      }),
    []
  );

  const ringMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDim: { value: 0 },
          uCorePos: { value: new THREE.Vector3(0, 0, 0) },
          uDustColor: { value: new THREE.Color(RING_DUST_COLOR) },
          uRingInner: { value: RING_INNER },
          uRingOuter: { value: RING_OUTER },
          uRadiusUnit: { value: STAR_RADIUS },
        },
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    []
  );

  const scratch = useMemo(() => ({ position: new THREE.Vector3() }), []);

  /* ---- Universe stars: gold override + larger scale ----
   * Written from `baseScales` so the boost is idempotent — StrictMode and
   * HMR re-run effects, and a `*=` here would compound on every pass.
   */
  useEffect(() => {
    const overrideAttr = geometry.getAttribute('aOverride');
    if (!overrideAttr) return;

    const override = overrideAttr.array;
    bindings.indexById.forEach((idx, id) => {
      if (!getUniverseById(id)) return;
      override[idx] = 1;
      data.scales[idx] = data.baseScales[idx] * UNIVERSE_SCALE_BOOST;
    });
    overrideAttr.needsUpdate = true;
  }, [bindings, data, geometry]);

  /* ---- Seed the animated scale attribute from (already boosted) scales.
   * Declared after the boost effect on purpose: effects run in order.
   */
  useEffect(() => {
    const scaleAttr = geometry.getAttribute('aScale');
    const ringScaleAttr = ringGeometry?.getAttribute('aScale');
    if (!scaleAttr) return;

    scaleAttr.array.set(data.scales);
    scaleAttr.needsUpdate = true;

    if (ringScaleAttr) {
      ringData.byPlanet.forEach((k, i) => {
        ringScaleAttr.array[k] = data.scales[i];
      });
      ringScaleAttr.needsUpdate = true;
    }

    animRef.current.clear();
    prevSelectedRef.current = -1;
  }, [data, geometry, ringGeometry, ringData]);

  /* ---- Publish id → position ---- */
  useEffect(() => {
    const positionsById = new Map();
    bindings.indexById.forEach((idx, id) => {
      positionsById.set(
        id,
        new THREE.Vector3(
          data.orbit[idx * 4 + 0] * Math.cos(data.orbit[idx * 4 + 2]),
          data.orbit[idx * 4 + 1],
          data.orbit[idx * 4 + 0] * Math.sin(data.orbit[idx * 4 + 2])
        )
      );
    });
    setStarPositions(positionsById);
  }, [data, bindings, setStarPositions]);

  /* ---- Pointer tracking ---- */
  const pointerRef = useRef({
    x: 0,
    y: 0,
    clientX: 0,
    clientY: 0,
    away: true,
  });

  useEffect(() => {
    const el = gl.domElement;

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const p = pointerRef.current;
      p.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      p.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      p.clientX = e.clientX;
      p.clientY = e.clientY;
      p.away = false;
    };

    const onLeave = () => {
      pointerRef.current.away = true;
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [gl]);

  /* ------------------------------------------------------------------ *
   * Frame loop — GPU drives motion, CPU only picks and lerps a handful
   * ------------------------------------------------------------------ */
  const hoverThrottle = useRef(0);
  const lastHover = useRef(-1);
  const simTime = useRef(0);
  const timeScale = useRef(1);
  const hoveredIdx = useRef(-1);

  /* Selection changes arrive as props, so queue both ends of the transition. */
  useEffect(() => {
    const prev = prevSelectedRef.current;
    if (prev === selectedIndex) return;
    if (prev >= 0) animRef.current.add(prev);
    if (selectedIndex >= 0) animRef.current.add(selectedIndex);
    prevSelectedRef.current = selectedIndex;
  }, [selectedIndex]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    /* Gravitational time dilation — slow down when hovering */
    const targetTimeScale = hoveredIdx.current >= 0 ? 0.08 : 1.0;
    timeScale.current += (targetTimeScale - timeScale.current) * Math.min(1, 8 * dt);
    simTime.current += dt * timeScale.current;

    /* One clock for both meshes keeps planets and rings locked together. */
    material.uniforms.uTime.value = simTime.current;
    ringMaterial.uniforms.uTime.value = simTime.current;

    const dragging = gl.domElement.__isDragging === true;
    const canHover =
      !pointerRef.current.away &&
      !dragging &&
      (phase === 'idle' || phase === 'focused');

    /* ---- Screen-space picking ---- */
    if (canHover) {
      hoverThrottle.current += dt;
      if (hoverThrottle.current > 0.05) {
        hoverThrottle.current = 0;

        const rect = gl.domElement.getBoundingClientRect();
        const dpr = Math.min(gl.getPixelRatio(), 2);
        const px = (pointerRef.current.clientX - rect.left) * dpr;
        const py = (pointerRef.current.clientY - rect.top) * dpr;

        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const tanHalfFov = Math.tan(vFov / 2);

        let closestDist = Infinity;
        let closestIdx = -1;

        for (let i = 0; i < count; i++) {
          orbitPos(data.orbit, i, simTime.current, scratch.position);
          scratch.position.project(camera);

          if (scratch.position.z > 1) continue;

          const sx = (scratch.position.x * 0.5 + 0.5) * rect.width * dpr;
          const sy = (-scratch.position.y * 0.5 + 0.5) * rect.height * dpr;

          const dist = Math.hypot(sx - px, sy - py);

          const minHit = HIT_PIXELS * dpr;
          const hitRadius = Math.max(
            minHit,
            (STAR_RADIUS * data.scales[i] / Math.max(0.1, scratch.position.z)) *
              (rect.height * dpr * 0.5) / tanHalfFov
          );

          if (dist < hitRadius && dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }

        const id = closestIdx;
        hoveredIdx.current = id;

        if (id !== lastHover.current) {
          if (lastHover.current >= 0) animRef.current.add(lastHover.current);
          if (id >= 0) animRef.current.add(id);
          lastHover.current = id;
          setHoveredStar(id);
          gl.domElement.style.cursor = id >= 0 ? 'pointer' : 'auto';

          const node = tooltipRef.current;
          if (node) {
            if (id >= 0) {
              const universeId = bindings.idByIndex.get(id);
              const universe = universeId ? getUniverseById(universeId) : null;
              node.textContent = universe ? universe.name : `Universe #${id + 1}`;
              node.style.opacity = '1';
            } else {
              node.style.opacity = '0';
            }
          }
        } else if (id >= 0 && tooltipRef.current) {
          orbitPos(data.orbit, id, simTime.current, scratch.position);
          scratch.position.project(camera);
          const sx = (scratch.position.x * 0.5 + 0.5) * rect.width;
          const sy = (-scratch.position.y * 0.5 + 0.5) * rect.height;
          const node = tooltipRef.current;
          node.style.left = `${sx + rect.left}px`;
          node.style.top = `${sy + rect.top}px`;
        }
      }
    } else if (lastHover.current !== -1) {
      animRef.current.add(lastHover.current);
      lastHover.current = -1;
      hoveredIdx.current = -1;
      setHoveredStar(-1);
      gl.domElement.style.cursor = 'auto';
      if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
    }

    /* ---- Hover / select scale easing ----
     * Only the planets that are actually transitioning are touched: two
     * writes and a 22 KB attribute upload instead of rebuilding 5500
     * matrices and streaming 1.4 MB per frame.
     */
    const anim = animRef.current;
    if (anim.size > 0) {
      const scaleAttr = geometry.getAttribute('aScale');
      const ringScaleAttr = ringGeometry?.getAttribute('aScale');
      const scales = scaleAttr.array;

      const hoverEase = 1 - Math.exp(-LERP_HOVER * dt);
      const selectEase = 1 - Math.exp(-LERP_SELECT * dt);

      anim.forEach((i) => {
        const base = data.scales[i];
        let target = base;
        if (i === lastHover.current) target = base * HOVER_SCALE;
        if (i === selectedIndex) target = base * SELECT_SCALE;

        const ease = i === selectedIndex ? selectEase : hoverEase;
        const next = scales[i] + (target - scales[i]) * ease;
        const settled = Math.abs(target - next) < base * 0.004;
        const value = settled ? target : next;

        scales[i] = value;
        const k = ringData.byPlanet.get(i);
        if (k !== undefined && ringScaleAttr) ringScaleAttr.array[k] = value;

        if (settled && target === base) anim.delete(i);
      });

      scaleAttr.needsUpdate = true;
      if (ringScaleAttr) ringScaleAttr.needsUpdate = true;
    }

    const dimEase = 1 - Math.exp(-4 * dt);
    material.uniforms.uDim.value += (dimmed - material.uniforms.uDim.value) * dimEase;
    ringMaterial.uniforms.uDim.value = material.uniforms.uDim.value;
  });

  /* ------------------------------------------------------------------ *
   * Click handling — uses screen-space picking result (hoveredIdx)
   * ------------------------------------------------------------------ */
  const clickState = useRef({ downX: 0, downY: 0 });

  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e) => {
      clickState.current.downX = e.clientX;
      clickState.current.downY = e.clientY;
    };

    const onUp = (e) => {
      if (useUniverseStore.getState().phase !== 'idle') return;

      const travel = Math.hypot(
        e.clientX - clickState.current.downX,
        e.clientY - clickState.current.downY
      );
      if (travel > CLICK_PIXEL_THRESHOLD) return;

      const idx = hoveredIdx.current;
      if (idx < 0) return;

      const id = bindings.idByIndex.get(idx);
      if (!id) return;

      if (tooltipRef.current) tooltipRef.current.style.opacity = '0';

      /* Publish fresh orbital position before selecting */
      const freshPos = orbitPos(
        data.orbit,
        idx,
        simTime.current,
        new THREE.Vector3()
      );

      const positionsById = useUniverseStore.getState().starPositions;
      if (positionsById) positionsById.set(id, freshPos);

      useUniverseStore.getState().selectUniverse(id);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
    };
  }, [gl, bindings, data]);

  /* ---- Cleanup ---- */
  useEffect(() => {
    return () => {
      geometry.dispose();
      ringGeometry?.dispose();
      material.dispose();
      ringMaterial.dispose();
    };
  }, [geometry, ringGeometry, material, ringMaterial]);

  return (
    <>
      {/* Planet field — one instanced draw, screen-space picked */}
      <mesh
        geometry={geometry}
        material={material}
        frustumCulled={false}
        raycast={() => null}
      />

      {/* Saturn-like rings — only the ~30% that own a ring are instanced */}
      {ringGeometry && (
        <mesh
          geometry={ringGeometry}
          material={ringMaterial}
          frustumCulled={false}
          raycast={() => null}
          renderOrder={1}
        />
      )}

      {/* Central black hole — hub */}
      <BlackHole onClick={() => {
        if (useUniverseStore.getState().phase !== 'idle') return;
        if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
        window.location.assign('/hub');
      }} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * BlackHole — event horizon + photon ring + accretion disk
 * ------------------------------------------------------------------ */
const BH_ACCRETION_COUNT = 1200;

function buildAccretionDisk(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);

  const color = new THREE.Color();
  const innerR = BH_RADIUS + 0.2;
  const outerR = BH_RADIUS + 3.5;

  for (let i = 0; i < count; i++) {
    const t = Math.pow(Math.random(), 0.6);
    const r = innerR + t * (outerR - innerR);
    const angle = Math.random() * Math.PI * 2;

    const y = (Math.random() - 0.5) * 0.12 * (1 - t * 0.5);
    positions[i * 3 + 0] = Math.cos(angle) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * r;

    const warm = Math.random();
    if (warm > 0.6) {
      color.setHSL(0.06 + Math.random() * 0.04, 1.0, 0.6 + Math.random() * 0.3);
    } else if (warm > 0.3) {
      color.setHSL(0.08 + Math.random() * 0.05, 0.9, 0.55 + Math.random() * 0.25);
    } else {
      color.setHSL(0.1, 0.4, 0.7 + Math.random() * 0.3);
    }
    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    scales[i] = 0.3 + Math.random() * 0.7;
  }

  return { positions, colors, scales };
}

function BlackHole({ onClick }) {
  const holeRef = useRef(null);
  const diskRef = useRef(null);
  const ringRef = useRef(null);
  const { gl, camera } = useThree();

  const pointerRef = useRef({ x: 0, y: 0, away: true });
  const hoverTarget = useRef(false);

  const scratch = useMemo(
    () => ({ raycaster: new THREE.Raycaster(), matrix: new THREE.Matrix4() }),
    []
  );

  /* ---- Pointer tracking ---- */
  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const p = pointerRef.current;
      p.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      p.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      p.away = false;
    };
    const onLeave = () => { pointerRef.current.away = true; };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [gl]);

  /* ---- Static geometry / materials ---- */
  const holeGeometry = useMemo(() => new THREE.SphereGeometry(BH_RADIUS, 32, 32), []);
  const diskParticle = useMemo(() => new THREE.SphereGeometry(0.04, 6, 6), []);

  const holeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x000000 }), []);

  const diskMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false }),
    []
  );

  /* Photon ring — bright thin torus at the photon sphere */
  const ringGeometry = useMemo(
    () => new THREE.TorusGeometry(BH_RADIUS * 1.5, 0.06, 8, 120),
    []
  );
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffb040,
        transparent: true,
        opacity: 0.9,
        toneMapped: false,
      }),
    []
  );

  const diskData = useMemo(() => buildAccretionDisk(BH_ACCRETION_COUNT), []);

  /* ---- Seed accretion disk instances once ---- */
  useEffect(() => {
    const d = diskRef.current;
    if (!d) return;
    const color = new THREE.Color();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    for (let i = 0; i < BH_ACCRETION_COUNT; i++) {
      pos.set(
        diskData.positions[i * 3],
        diskData.positions[i * 3 + 1],
        diskData.positions[i * 3 + 2]
      );
      const s = diskData.scales[i];
      scl.set(s, s, s);
      d.setMatrixAt(i, scratch.matrix.compose(pos, quat, scl));

      color.setRGB(
        diskData.colors[i * 3],
        diskData.colors[i * 3 + 1],
        diskData.colors[i * 3 + 2]
      );
      d.setColorAt(i, color);
    }

    d.instanceMatrix.needsUpdate = true;
    if (d.instanceColor) d.instanceColor.needsUpdate = true;
    d.frustumCulled = false;
  }, [diskData, scratch]);

  /* ---- Cleanup ---- */
  useEffect(
    () => () => {
      holeGeometry.dispose();
      diskParticle.dispose();
      ringGeometry.dispose();
      holeMaterial.dispose();
      diskMaterial.dispose();
      ringMaterial.dispose();
    },
    [holeGeometry, diskParticle, ringGeometry, holeMaterial, diskMaterial, ringMaterial]
  );

  /* ---- Frame: disk spin, ring tilt, hover raycast ---- */
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const disk = diskRef.current;
    const ring = ringRef.current;

    if (disk) disk.rotation.y += dt * 0.22;
    if (ring) {
      ring.rotation.z += dt * 0.06;
      ring.rotation.x = Math.PI * 0.5 + Math.sin(performance.now() * 0.0003) * 0.12;
    }

    /* Hover detection */
    const hole = holeRef.current;
    if (hole && !pointerRef.current.away) {
      scratch.raycaster.setFromCamera(pointerRef.current, camera);
      const hovering = scratch.raycaster.intersectObject(hole, false).length > 0;
      if (hovering !== hoverTarget.current) {
        hoverTarget.current = hovering;
        gl.domElement.style.cursor = hovering ? 'pointer' : 'auto';
      }
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <group>
      {/* Accretion disk — warm particles orbiting the singularity */}
      <instancedMesh
        ref={diskRef}
        args={[diskParticle, diskMaterial, BH_ACCRETION_COUNT]}
        frustumCulled={false}
        raycast={() => null}
      />

      {/* Photon ring */}
      <mesh
        ref={ringRef}
        geometry={ringGeometry}
        material={ringMaterial}
        raycast={() => null}
      />

      {/* Event horizon — the clickable singularity */}
      <mesh
        ref={holeRef}
        geometry={holeGeometry}
        material={holeMaterial}
        onClick={handleClick}
      />
    </group>
  );
}

export { STAR_RADIUS, BH_RADIUS, HOVER_SCALE, SELECT_SCALE };
