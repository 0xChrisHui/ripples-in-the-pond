'use client';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { Suspense, useMemo, useRef } from 'react';
import type { ShaderMaterial } from 'three';
import type { GLFlags } from '../gl-flags';
import { baseToneVertexShader, baseToneFragmentShader } from '../base-tone-shader';
import { getEclipseMix } from '../focus/playback-focus';

function Tone({ artDir }: { artDir: GLFlags['artDir'] }) {
  const matRef = useRef<ShaderMaterial>(null);
  const eclipseTex = useTexture('/pond-eclipse-black.svg');
  const uniforms = useMemo(() => ({ uMode: { value: artDir === 'black' ? 1 : 0 },
    uEclipseMix: { value: 0 }, uEclipseTex: { value: eclipseTex } }), [artDir, eclipseTex]);
  useFrame(() => { if (matRef.current) matRef.current.uniforms.uEclipseMix.value = getEclipseMix(); });
  return <mesh frustumCulled={false} renderOrder={-1}>
    <planeGeometry args={[2, 2]} />
    <shaderMaterial ref={matRef} key={artDir} vertexShader={baseToneVertexShader}
      fragmentShader={baseToneFragmentShader} uniforms={uniforms} depthWrite={false} />
  </mesh>;
}

/** 水面仍在唯一Canvas内；将基调职责独立，给局部前景保留接线空间。 */
export default function BaseTone(props: { artDir: GLFlags['artDir'] }) {
  return <Suspense fallback={null}><Tone {...props} /></Suspense>;
}
