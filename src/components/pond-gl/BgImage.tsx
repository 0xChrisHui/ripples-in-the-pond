'use client';

import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { Texture } from 'three';
import { baseToneVertexShader } from './base-tone-shader';

/**
 * 背景图层（测试用）— 全屏裁剪空间 quad，cover 铺满（保持比例，溢出裁切）。
 * 垫在最底（renderOrder -2），与纯色基调互斥（bgImage 开时 PondGL 不画 BaseTone）。
 */
const bgFragmentShader = /* glsl */ `
  precision mediump float;
  uniform sampler2D uTex;
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
    gl_FragColor = texture2D(uTex, uv);
  }
`;

interface BgUniforms {
  uTex: { value: Texture | null };
  uImgAspect: { value: number };
  uScreenAspect: { value: number };
  [key: string]: { value: unknown };
}

/** 模块级写入（避开 react-hooks/immutability 对组件体内改 hook 返回值的限制） */
function setScreenAspect(u: BgUniforms, aspect: number): void {
  u.uScreenAspect.value = aspect;
}

export default function BgImage({ url }: { url: string }) {
  const tex = useTexture(url);
  const size = useThree((s) => s.size);
  const img = tex.image as { width?: number; height?: number } | undefined;
  const imgAspect = (img?.width ?? 1) / (img?.height ?? 1);

  const uniforms = useMemo<BgUniforms>(() => ({
    uTex: { value: tex },
    uImgAspect: { value: imgAspect },
    uScreenAspect: { value: size.width / size.height },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tex, imgAspect]);

  useEffect(() => { setScreenAspect(uniforms, size.width / size.height); }, [size, uniforms]);

  return (
    <mesh frustumCulled={false} renderOrder={-2}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={baseToneVertexShader}
        fragmentShader={bgFragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
