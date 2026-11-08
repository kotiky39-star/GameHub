// GravitationalLens.jsx — post-processing gravitational lens around the singularity
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BlendFunction, Effect } from 'postprocessing';
import { wrapEffect } from '@react-three/postprocessing';
import * as THREE from 'three';

const BH_WORLD_RADIUS = 1.2;

/*
 * postprocessing 6.39 Effect signature is super(name, fragmentShader, options) —
 * the shader is a positional argument, NOT part of the options object.
 */
const LENS_FRAGMENT_SHADER = /* glsl */ `
  uniform vec2 uScreenCenter;
  uniform float uLensRadius;
  uniform float uAspect;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    /*
     * UV space is 0..1 on both axes, so a raw length() draws an ellipse on a
     * wide viewport. Scaling x by the aspect makes uLensRadius a true radius
     * expressed in screen-height units.
     */
    vec2 delta = uv - uScreenCenter;
    delta.x *= uAspect;
    float d = length(delta);
    float r = uLensRadius;

    /* Gravitational lens: bend light toward the center */
    float bend = (r * r) / (d * d + r * r * 0.3) * 0.55;
    vec2 dir = d > 0.0001 ? delta / d : vec2(0.0);

    /*
     * Einstein ring. Width is derived from r rather than fixed in UV units,
     * so the ring stays proportionally thin as the lens radius changes.
     */
    float ringDist = abs(d - r * 1.1);
    float ringWidth = r * 0.22;
    float ringRel = ringDist / max(ringWidth, 1e-5);
    float ring = exp(-ringRel * ringRel * 1.6) * 1.4;

    /* Swirl: tangential distortion near the hole */
    float swirlStrength = exp(-d / r * 1.8) * 0.18;
    vec2 tangent = vec2(-dir.y, dir.x);

    vec2 sampleUv = uv - dir * bend * 0.22 + tangent * swirlStrength * 0.09;
    vec4 lensed = texture2D(inputBuffer, sampleUv);

    /* Darken inside event horizon */
    float horizon = 1.0 - smoothstep(r * 0.5, r * 0.95, d);
    lensed.rgb *= (1.0 - horizon * 0.9);

    /* Photon ring glow */
    lensed.rgb += vec3(1.0, 0.7, 0.22) * ring * 0.9;

    outputColor = vec4(lensed.rgb, inputColor.a);
  }
`;

const LensEffect = wrapEffect(
  class GravLens extends Effect {
    constructor() {
      super('GravLens', LENS_FRAGMENT_SHADER, {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map([
          ['uScreenCenter', new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
          ['uLensRadius', new THREE.Uniform(0.2)],
          ['uAspect', new THREE.Uniform(1)],
        ]),
      });
    }
  }
);

/*
 * The lens is sized off the projected event horizon. LENS_SCREEN_SCALE is how
 * many horizon-radii the distortion covers — 1.07 keeps it tight around the
 * hole instead of swallowing the whole galactic core.
 */
const LENS_SCREEN_SCALE = 1.07;
const LENS_RADIUS_MIN = 0.012;
const LENS_RADIUS_MAX = 0.22;

export default function GravitationalLens() {
  const { camera, size } = useThree();
  const effectRef = useRef(null);
  const scratch = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  /*
   * Mutate effect uniforms every frame via the instance ref.
   * wrapEffect forwards `ref` to the underlying Effect object.
   */
  useFrame(() => {
    const effect = effectRef.current;
    if (!effect) return;

    scratch.set(0, 0, 0).project(camera);
    const cx = scratch.x * 0.5 + 0.5;
    const cy = scratch.y * 0.5 + 0.5;

    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    const dist = camera.position.length();
    const screenRadius = (BH_WORLD_RADIUS / Math.max(0.1, dist)) / Math.tan(fovRad / 2);
    const radius = THREE.MathUtils.clamp(
      screenRadius * LENS_SCREEN_SCALE,
      LENS_RADIUS_MIN,
      LENS_RADIUS_MAX
    );

    effect.uniforms.get('uScreenCenter').value.set(cx, cy);
    effect.uniforms.get('uLensRadius').value = radius;
    effect.uniforms.get('uAspect').value = size.width / Math.max(1, size.height);
  });

  return <LensEffect ref={effectRef} />;
}
