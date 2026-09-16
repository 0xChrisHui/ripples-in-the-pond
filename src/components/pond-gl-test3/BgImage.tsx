'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { ShaderMaterial, Texture } from 'three';
import { baseToneVertexShader } from './base-tone-shader';
import { getEclipseMix } from './focus/playback-focus';

/**
 * 背景图层（测试用）— 全屏裁剪空间 quad，cover 铺满（保持比例，溢出裁切）。
 * 垫在最底（renderOrder -2），与纯色基调互斥（bgImage 开时 PondGL 不画 BaseTone）。
 */
const bgFragmentShader = /* glsl */ `
  precision mediump float;
  uniform sampler2D uTex;
  uniform sampler2D uEclipseTex;
  uniform float uEclipseMix;
  uniform float uImgAspect;
  uniform float uScreenAspect;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    if (uScreenAspect > uImgAspect) {
      float scale = uImgAspect / uScreenAspect;       // 屏更宽 → 压缩 y 采样（裁上下）
      uv.y = (uv.y - 0.5) * scale + 0.5;
    } else {
      float scale = uScreenAspect / uImgAspect;        // 屏更高 → 压缩 x 采样（裁左右）
      uv.x = (uv.x - 0.5) * scale + 0.5;
    }
    vec4 waterFloor = texture2D(uTex, uv);
    vec4 blackFloor = texture2D(uEclipseTex, uv);
    gl_FragColor = mix(waterFloor, blackFloor, smoothstep(0.0, 1.0, uEclipseMix));
  }
`;

interface BgUniforms {
  uTex: { value: Texture | null };
  uEclipseTex: { value: Texture | null };
  uEclipseMix: { value: number };
  uImgAspect: { value: number };
  uScreenAspect: { value: number };
  [key: string]: { value: unknown };
}

/** 模块级写入（避开 react-hooks/immutability 对组件体内改 hook 返回值的限制） */
function setScreenAspect(u: BgUniforms, aspect: number): void {
  u.uScreenAspect.value = aspect;
}

export default function BgImage({ url, eclipseUrl = '/pond-eclipse-black.svg' }: {
  url: string; eclipseUrl?: string;
}) {
  const materialRef = useRef<ShaderMaterial>(null);
  const [tex, eclipseTex] = useTexture([url, eclipseUrl]);
  const size = useThree((s) => s.size);
  const img = tex.image as { width?: number; height?: number } | undefined;
  const imgAspect = (img?.width ?? 1) / (img?.height ?? 1);

  const uniforms = useMemo<BgUniforms>(() => ({
    uTex: { value: tex },
    uEclipseTex: { value: eclipseTex },
    uEclipseMix: { value: 0 },
    uImgAspect: { value: imgAspect },
    uScreenAspect: { value: size.width / size.height },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tex, eclipseTex, imgAspect]);

  useEffect(() => { setScreenAspect(uniforms, size.width / size.height); }, [size, uniforms]);
  useFrame(() => {
    if (materialRef.current) materialRef.current.uniforms.uEclipseMix.value = getEclipseMix();
  });

  return (
    <mesh frustumCulled={false} renderOrder={-2}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={baseToneVertexShader}
        fragmentShader={bgFragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
