'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DoubleSide, InstancedMesh, Matrix4, type ShaderMaterial } from 'three';
import { getRippleTuning } from '../water/spike/ripple-tuning';
import { getEffectiveWaterLevel } from '../water/water-level';
import { columnsVertex, columnsFragment, COL_Z_BASE, COL_Z_TOP } from './water-columns-shaders';

/**
 * K12 — 水位标尺柱（礁石 / 水晶簇）。钉死的垂直元素，水从其身上漫过 → 看得见的水位/深度参照。
 *
 * 范式同 WaterPlants：InstancedMesh 一次 draw call、NDC 裁剪空间（不经相机）、模块级 helper 每帧
 * 命令式写实例矩阵（避 react-hooks/immutability）、uniform 写 material 真身（避 R3F 拷贝坑）。
 * 柱**钉死**：几何只随 aspect/count/参数 变（不随 K6 缩放、不漂）；水线/透视/风格全走 shader uniform。
 * 两风格 kind（0=石/1=晶）各半，由 reefStones/crystalPillars 两开关经 uStoneOn/uCrystalOn 门控渲染。
 */

const MAX_COLUMNS = 64; // 柱上限（colCount 0–1 映射可见数；偏边缘撒点、稀疏不抢球）
const TWO_PI = 6.2831853;

interface ColUniforms {
  uPersp: { value: number };
  uAspect: { value: number };
  uWaterLevel: { value: number };
  uTime: { value: number };
  uOpacity: { value: number };
  uStoneOn: { value: number };
  uCrystalOn: { value: number };
  uZBase: { value: number };
  uZTop: { value: number };
  [key: string]: { value: unknown };
}

/** 种子随机生成柱子（可复现、刷新不乱跳）：偏边缘撒点（半径 0.45–1.05，避中心球密集区 + foreshorten）。
 *  aBase=柱根钉死 NDC 位（透视径向方向）；aMeta=(柱高, 半宽, kind 0石/1晶)。 */
function makeColumns(): { aBase: Float32Array; aMeta: Float32Array } {
  const aBase = new Float32Array(MAX_COLUMNS * 2);
  const aMeta = new Float32Array(MAX_COLUMNS * 3);
  let s = 1337;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < MAX_COLUMNS; i++) {
    const r = 0.45 + rnd() * 0.6;      // 偏边缘：根离中心 0.45–1.05
    const a = rnd() * TWO_PI;
    aBase[i * 2] = Math.cos(a) * r;
    aBase[i * 2 + 1] = Math.sin(a) * r;
    const kind = rnd() < 0.5 ? 0 : 1;
    if (kind === 0) {                          // 礁石：矮而宽（圆钝巨石）
      aMeta[i * 3] = 0.18 + rnd() * 0.16;
      aMeta[i * 3 + 1] = 0.07 + rnd() * 0.06;
    } else {                                   // 水晶柱：高而细
      aMeta[i * 3] = 0.5 + rnd() * 0.5;
      aMeta[i * 3 + 1] = 0.013 + rnd() * 0.018;
    }
    aMeta[i * 3 + 2] = kind;
  }
  return { aBase, aMeta };
}

/** 每帧写实例矩阵（模块级避 immutability）：单位 quad → 宽 w/高 hh，底边(uv.y=0)钉在根 (bx,by)。
 *  柱钉死，只按 aspect(x 校正免宽屏拉胖)/count(超 count 缩 0 隐)/colHeight·colWidth 调几何；位姿不随水/缩放动。 */
function stepColumns(
  mesh: InstancedMesh, aBase: Float32Array, aMeta: Float32Array, m: Matrix4,
  invA: number, count: number, hMul: number, wMul: number,
): void {
  for (let i = 0; i < MAX_COLUMNS; i++) {
    const hidden = i >= count;
    const w = hidden ? 0 : aMeta[i * 3 + 1] * 2 * wMul * invA;
    const hh = hidden ? 0 : aMeta[i * 3] * hMul;
    const bx = aBase[i * 2];
    const by = aBase[i * 2 + 1];
    // 列主序 4×4：scale(w,hh) + translate(bx, by+hh/2)（底边落在根 → 向上长 hh）
    m.set(
      w, 0, 0, bx,
      0, hh, 0, by + hh / 2,
      0, 0, 1, 0,
      0, 0, 0, 1,
    );
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

export default function WaterColumns(
  { reefStones = false, crystalPillars = false }: { reefStones?: boolean; crystalPillars?: boolean },
) {
  const meshRef = useRef<InstancedMesh>(null);
  const matRef = useRef<ShaderMaterial>(null);
  const size = useThree((s) => s.size);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const cols = useMemo(() => makeColumns(), []);
  const m = useMemo(() => new Matrix4(), []);

  const uniforms = useMemo<ColUniforms>(() => ({
    uPersp: { value: 0.18 },
    uAspect: { value: 1 },
    uWaterLevel: { value: 0 },
    uTime: { value: 0 },
    uOpacity: { value: 0.7 },
    uStoneOn: { value: 0 },
    uCrystalOn: { value: 0 },
    uZBase: { value: COL_Z_BASE },
    uZTop: { value: COL_Z_TOP },
  }), []);

  useFrame((s) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;
    const t = getRippleTuning();
    const u = mat.uniforms; // R3F 拷贝坑：写 material 真身
    u.uPersp.value = t.perspStrength;
    u.uAspect.value = aspect;
    u.uWaterLevel.value = getEffectiveWaterLevel(); // 水线 = 真实水面层(归一 0.10–1.00)，在柱身上下移动（钉死的标尺）
    u.uTime.value = s.clock.getElapsedTime();
    u.uOpacity.value = t.colOpacity;
    u.uStoneOn.value = reefStones ? 1 : 0;
    u.uCrystalOn.value = crystalPillars ? 1 : 0;
    const count = Math.max(0, Math.min(MAX_COLUMNS, Math.round(t.colCount * MAX_COLUMNS)));
    stepColumns(mesh, cols.aBase, cols.aMeta, m, 1 / Math.max(0.0001, aspect), count, t.colHeight, t.colWidth);
  });

  return (
    // renderOrder 0：进 realScene、被合成折射；钉死、不随 K6 缩放。
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_COLUMNS]} frustumCulled={false}>
      <planeGeometry args={[1, 1]}>
        <instancedBufferAttribute attach="attributes-aBase" args={[cols.aBase, 2]} />
        <instancedBufferAttribute attach="attributes-aMeta" args={[cols.aMeta, 3]} />
      </planeGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={columnsVertex}
        fragmentShader={columnsFragment}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        side={DoubleSide}
      />
    </instancedMesh>
  );
}
