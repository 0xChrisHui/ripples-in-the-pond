'use client';

import { getRippleTuning } from '../water/spike/ripple-tuning';
import { prefersReducedMotion } from '../reduced-motion';
import type { GlPhysNode } from './gl-sim-setup';

/**
 * 球运动 = ①「球浮动」层级波动（移植 /test3，优化自旧"全屏正弦浮沉"）+ ② 播放球浮出成焦点（保留 test1）。
 *
 * 球浮动：每隔(2s÷bobScale 触发频率) 随机挑 1 颗未在波动的球走 sin(π·t) 钟形 —— 朝大(近)或朝小(远)摆一程再回；
 *   每次幅度/速度在区间随机（waveAmp[Min,Max]/waveSpeed[Min,Max]）。任一刻只少数球在波动 → 缓慢有机的"层级起伏"。
 *   产出 node._waveZ ∈ [-amp,amp]；/test1 无透视 → SphereInstances/水面遮罩/花瓣遮挡把它当**尺寸倍率 (1+_waveZ)** → 球平滑变大/变小。
 * 焦点：播放球用 _focusLerp 缓动升到水面之上（displayZ）；与尺寸波动正交，二者共存。
 * motionOn=false 或 reduced-motion → 清波动、_waveZ=0、displayZ=z（静止）。SphereInstances priority-0 每帧调一次。
 */

const TRIGGER_BASE_MS = 2000; // 触发间隔基准（/test 同款 2s；实际 ÷bobScale 触发频率）
const DUR_REF_MS = 10000;     // speed=1 → 单次波动 10s；实际时长 = DUR_REF ÷ 本次随机速度（越快越短）
const FOCUS_LERP = 0.06;      // 播放浮出缓动率（越小越慢，切歌后≈1s 浮到位）

interface Wave { start: number; dur: number; dir: number; amp: number } // amp/dur 每次波动随机取（区间）
const activeWaves = new Map<string, Wave>();
let lastTrigger = 0;

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }
function rand(min: number, max: number): number { return min + Math.random() * Math.max(0, max - min); }

export function stepSphereMotion(
  nodes: GlPhysNode[],
  timeSec: number,
  waterLevel: number,
  playingId: string | null,
  motionOn: boolean,
): void {
  const now = timeSec * 1000;
  if (!motionOn || prefersReducedMotion()) {
    if (activeWaves.size) activeWaves.clear();
    for (const n of nodes) { n._waveZ = 0; n.displayZ = n.z; n._focusLerp = 0; }
    return;
  }
  if (nodes.length === 0) return;
  const t = getRippleTuning();
  // 球浮动触发：每 interval 随机挑一颗未在波动的球（撞到正在波动的则本次跳过，避免叠加）
  const interval = TRIGGER_BASE_MS / Math.max(0.2, t.bobScale);
  if (now - lastTrigger > interval) {
    lastTrigger = now;
    const cand = nodes[Math.floor(Math.random() * nodes.length)];
    if (cand && !activeWaves.has(cand.id)) {
      const amp = rand(t.waveAmpMin, t.waveAmpMax);
      const dur = DUR_REF_MS / Math.max(0.05, rand(t.waveSpeedMin, t.waveSpeedMax));
      activeWaves.set(cand.id, { start: now, dur, dir: Math.random() < 0.5 ? 1 : -1, amp });
    }
  }
  // 清理过期波动（含切组后已不在 nodes 的残留），防 activeWaves 累积
  for (const [id, w] of activeWaves) if (now - w.start >= w.dur) activeWaves.delete(id);
  for (const n of nodes) {
    // 球浮动层级波动 → _waveZ：既**改深度/层级**(进 displayZ)又当**尺寸倍率**(1+_waveZ，SphereInstances/遮罩/编号消费)
    let waveZ = 0;
    const w = activeWaves.get(n.id);
    if (w) {
      const p = (now - w.start) / w.dur;
      if (p >= 1) activeWaves.delete(n.id);
      else waveZ = w.dir * w.amp * Math.sin(p * Math.PI); // 钟形：0 → ±本次幅度 → 0
    }
    n._waveZ = waveZ;
    // 焦点浮出：播放球升到水面之上（max 不下拽本就更高的浅球），_focusLerp 缓动
    const focusTarget = n.id === playingId ? 1 : 0;
    const lerp = (n._focusLerp ?? 0) + (focusTarget - (n._focusLerp ?? 0)) * FOCUS_LERP;
    n._focusLerp = lerp;
    const focusZ = clamp01(n.z + (Math.max(n.z, waterLevel + t.focusMargin) - n.z) * lerp);
    // 深度 = 焦点 + 波动 → 层级随浮动改变；穿过水面时 getSubmerge 变化 → ripple-feed 触发出入水溅起交互
    n.displayZ = clamp01(focusZ + waveZ);
  }
}
