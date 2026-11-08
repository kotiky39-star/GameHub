// Scene.jsx
import { Suspense } from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import Space from './Space';
import CameraController from './CameraController';
import GravitationalLens from './GravitationalLens';

export default function Scene({ lowQuality }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.5}
        color="#ffffff"
      />

      <Suspense fallback={null}>
        <Space lowQuality={lowQuality} />
        <CameraController />
      </Suspense>

      {/* Post-processing.
          multisampling=0: MSAA on the half-float composer target is the
          single most expensive default here (4 samples over the whole
          screen) and buys nothing for 3-20px planets.
          mipmapBlur + resolutionScale: the fastest bloom path — a
          downsampled MIP chain (0.5x) blurred per level, no heavy
          multi-pass Gaussian. */}
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={lowQuality ? 0.4 : 0.7}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
          radius={lowQuality ? 0.7 : 0.85}
          resolutionScale={lowQuality ? 0.35 : 0.45}
        />
        {!lowQuality && <GravitationalLens />}
      </EffectComposer>
    </>
  );
}
