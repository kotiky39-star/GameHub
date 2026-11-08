import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import UniverseGalaxy from './UniverseGalaxy';
import CameraController from './CameraController';

const STAR_COUNT = 3000;
const STAR_FIELD_RADIUS = 140;

function Starfield({ lowQuality = false }) {
  const count = lowQuality ? Math.floor(STAR_COUNT * 0.5) : STAR_COUNT;

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.cbrt(Math.random()) * STAR_FIELD_RADIUS;
      const sqrt = Math.sqrt(1 - u * u);
      positions[i * 3 + 0] = Math.cos(theta) * sqrt * r;
      positions[i * 3 + 1] = u * r;
      positions[i * 3 + 2] = Math.sin(theta) * sqrt * r;

      const t = Math.pow(Math.random(), 2.2);
      sizes[i] = 0.35 + t * 0.25;
      alphas[i] = 0.3 + t * 0.5;
      const warm = Math.random();
      color.setHSL(warm > 0.85 ? 0.09 : warm > 0.6 ? 0.58 : 0.62, 0.15 + Math.random() * 0.35, 0.82 + Math.random() * 0.16);
      colors[i * 3 + 0] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), STAR_FIELD_RADIUS * 1.1);

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      uniforms: { uPixelRatio: { value: 1 }, uScale: { value: 1 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; varying float vAlpha; varying vec3 vColor; uniform float uPixelRatio; uniform float uScale; void main() { vAlpha = aAlpha; vColor = color; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale * uPixelRatio * (300.0 / -mvPosition.z); gl_Position = projectionMatrix * mvPosition; }`,
      fragmentShader: `varying float vAlpha; varying vec3 vColor; void main() { vec2 uv = gl_PointCoord - vec2(0.5); float d = length(uv); if (d > 0.5) discard; float falloff = smoothstep(0.5, 0.0, d); falloff *= falloff; gl_FragColor = vec4(vColor, vAlpha * falloff); }`,
      vertexColors: true,
    });
    return { geometry: geo, material: mat };
  }, [count]);

  const { gl, size } = useThree();
  useEffect(() => {
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    material.uniforms.uScale.value = Math.max(0.6, Math.min(1.6, size.height / 900));
  }, [material, gl, size.height]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

export default function Space({ lowQuality = false }) {
  return (
    <>
      <ambientLight intensity={0.12} color="#1a2540" />
      <Starfield lowQuality={lowQuality} />
      <UniverseGalaxy lowQuality={lowQuality} />
      <CameraController />
    </>
  );
}