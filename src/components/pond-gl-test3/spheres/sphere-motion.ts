'use client';

import { getRippleTuning } from '../water/spike/ripple-tuning';
import { prefersReducedMotion } from '../reduced-motion';
import type { GlPhysNode } from './gl-sim-setup';

/**
 * /test3「球浮动」= **与深度解耦的脉冲**（不再写 renderDepth → 与滚轮零冲突、深度输出稳定）。
 *
 * 事件驱动：每隔(2s÷bobScale 触发频率) 随机挑 1 颗未在脉动的球，走 sin(π·t) 钟形脉冲一程
 * （幅度 waveAmp[Min,Max]、速度 waveSpeed[Min,Max] 各自区间随机）。产出每球 node._waveZ ∈ [−幅,+幅]。
 * 投影端（SphereInstances）据此做「呼吸(大小脉动) + 径向轻浮(绕灭点聚散)」→ 看着像浮沉，但**不进深度轴**，
 * 故滚轮拖动时浮动球与其它球严格同步、不窜不弹。任一时刻只少数球在脉动 → 缓慢、有机。
 *
 * 这版刻意去掉了所有"读滚轮状态"的耦合（scrollFade / 极限收敛 / 余量裁剪）——因为浮动已不进深度，
 * 不再需要追着滚轮打补丁；脉冲是纯 sin 钟形，平滑、无突跳。motionOn=false / reduced-motion → 清空、_waveZ=0。
 */

const TRIGGER_BASE_MS = 2000; // 触发间隔基准（实际 ÷bobScale 触发频率）
const DUR_REF_MS = 10000;     // speed=1 → 单程 10s；实际时长 = DUR_REF ÷ 本次随机速度（越快越短）

interface Wave { start: number; dur: number; dir: number; amp: number } // amp/dur 每次随机取（区间）
const activeWaves = new Map<string, Wave>();
let lastTrigger = 0;

function rand(min: number, max: number): number {
  return min + Math.random() * Math.max(0, max - min); // min>max 退化为 min（不出负）
}

/** 每帧推进浮动脉冲 → 写 node._waveZ（投影端读它做呼吸 + 径向轻浮）。SphereInstances priority-0 每帧调一次。 */
export function stepSphereMotion(nodes: GlPhysNode[], timeSec: number, motionOn: boolean): void {
  const now = timeSec * 1000;
  if (!motionOn || prefersReducedMotion()) {
    if (activeWaves.size) activeWaves.clear();
    for (const n of nodes) { n._waveZ = 0; n.displayZ = n.z; }
    return;
  }
  if (nodes.length === 0) return;
  const t = getRippleTuning();
  // 触发：每 interval 挑一颗未在脉动的球（撞到正在脉动的则本次跳过，避免叠加）
  if (now - lastTrigger > TRIGGER_BASE_MS / Math.max(0.2, t.bobScale)) {
    lastTrigger = now;
    const cand = nodes[Math.floor(Math.random() * nodes.length)];
    if (cand && !activeWaves.has(cand.id)) {
      const amp = rand(t.waveAmpMin, t.waveAmpMax);
      const dur = DUR_REF_MS / Math.max(0.05, rand(t.waveSpeedMin, t.waveSpeedMax));
      activeWaves.set(cand.id, { start: now, dur, dir: Math.random() < 0.5 ? 1 : -1, amp });
    }
  }
  for (const [id, w] of activeWaves) if (now - w.start >= w.dur) activeWaves.delete(id); // 清过期波
  for (const n of nodes) {
    n.displayZ = n.z; // 没入判定回退用 displayZ=z（浮动不改深度 → 无需动）
    const w = activeWaves.get(n.id);
    if (!w) { n._waveZ = 0; continue; }
    const p = (now - w.start) / w.dur;
    if (p >= 1) { activeWaves.delete(n.id); n._waveZ = 0; continue; }
    n._waveZ = w.dir * w.amp * Math.sin(p * Math.PI); // 纯钟形脉冲 0→±幅→0，平滑、零滚轮耦合
  }
}
