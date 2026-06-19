'use client';

import { getRippleTuning } from '../water/spike/ripple-tuning';
import { getScrollExtremity, isScrolling } from '../pointer-fx';
import { prefersReducedMotion } from '../reduced-motion';
import type { GlPhysNode } from './gl-sim-setup';

/**
 * /test3「球浮动」= 层级波动（移植 /test 的 layerWave2，弃用早先的"全屏正弦浮沉/垂直跳动"）。
 *
 * 事件驱动：每隔(2s÷bobScale 触发频率) 随机挑 1 颗未在波动的球进入波动，走 sin(π·t) 钟形 —— 基准深度朝近(更大)
 * 或朝远(更小)摆一程再回。**每次波动的幅度、速度各自在区间内随机取**（waveAmp[Min,Max]/waveSpeed[Min,Max]）→ 更多元。
 * 任一时刻只少数球在波动 → 缓慢、有机的"层级起伏"，不是所有球一起快速跳。产出每球 node._waveZ（effDepth 域深度偏移）；
 * 投影端（renderDepth）叠进渲染深度 → 球平滑变大/变小 + 一点透视位移（不闪烁、不跳动）。
 * motionOn=false 或 prefers-reduced-motion → 清空波动、_waveZ=0（静止）。
 */

const TRIGGER_BASE_MS = 2000; // 触发间隔基准（/test 同款 2s；实际 ÷bobScale 触发频率）
const DUR_REF_MS = 10000;     // speed=1 对应的单次波动时长(10s)；实际时长 = DUR_REF ÷ 本次随机速度（越快越短）

interface Wave { start: number; dur: number; dir: number; amp: number } // amp/dur 每次波动随机取（区间）
const activeWaves = new Map<string, Wave>();
let lastTrigger = 0;
let scrollFade = 1; // 浮动整体淡入淡出系数：滚动时→0（无偏移、所有球随 shift 匀速）、停滚→1（浮动恢复）

function rand(min: number, max: number): number {
  return min + Math.random() * Math.max(0, max - min); // min>max 时退化为 min（不出负）
}

// 滚轮极限处收敛区间：|趋近度| ≤START 不压（中段全幅浮动、可越线溅起）、≥END 完全压（极限端越线方向归零）。
const CONV_START = 0.5, CONV_END = 0.85;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * 滚轮极限处收敛浮动：只削"会把球带过水面、回到另一侧"的方向分量 → 保证"滚到底必沉 / 滚到顶都出水"。
 * 同侧起伏照常（球不僵死，仍朝远离水面方向浮）；中段(|ext|<START)完全不削（保留双向穿越→出入水溅起）。
 * ext∈[-1,1]：<0 没入端（削上浮 raw>0）/ >0 出水端（削下沉 raw<0）。
 */
function convergeAtExtreme(raw: number, ext: number): number {
  const supp = smoothstep(CONV_START, CONV_END, Math.abs(ext));
  if (supp <= 0) return raw;
  if (ext < 0 && raw > 0) return raw * (1 - supp); // 没入端：压住越线的"上浮"分量
  if (ext > 0 && raw < 0) return raw * (1 - supp); // 出水端：压住越线的"下沉"分量
  return raw;
}

/** 每帧推进层级波动 → 写 node._waveZ（投影/没入端读它叠进渲染深度）。SphereInstances priority-0 每帧调一次。 */
export function stepSphereMotion(nodes: GlPhysNode[], timeSec: number, motionOn: boolean): void {
  const now = timeSec * 1000;
  if (!motionOn || prefersReducedMotion()) {
    if (activeWaves.size) activeWaves.clear();
    for (const n of nodes) { n._waveZ = 0; n.displayZ = n.z; }
    return;
  }
  if (nodes.length === 0) return;
  const t = getRippleTuning();
  // 触发：每 interval 挑一颗未在波动的球（撞到正在波动的则本次跳过，避免叠加）
  const interval = TRIGGER_BASE_MS / Math.max(0.2, t.bobScale);
  if (now - lastTrigger > interval) {
    lastTrigger = now;
    const cand = nodes[Math.floor(Math.random() * nodes.length)];
    if (cand && !activeWaves.has(cand.id)) {
      // 本次波动的幅度、速度各自在区间内随机 → 每颗球的沉浮都不一样
      const amp = rand(t.waveAmpMin, t.waveAmpMax);
      const dur = DUR_REF_MS / Math.max(0.05, rand(t.waveSpeedMin, t.waveSpeedMax));
      activeWaves.set(cand.id, { start: now, dur, dir: Math.random() < 0.5 ? 1 : -1, amp });
    }
  }
  // 清理过期波动（含切组后已不在 nodes 里的残留），防 activeWaves 累积
  for (const [id, w] of activeWaves) if (now - w.start >= w.dur) activeWaves.delete(id);
  const ext = getScrollExtremity(); // 滚轮极限趋近度（每帧读一次，所有球共用）
  // 滚动时把浮动整体淡到 0（缓动）→ 滚动期间所有球都只随 shift 匀速变层；杜绝个别球因 _waveZ 偏移
  // 被 renderDepth 的 clamp[0,1] 卡在端点（"不参与"）或被极限收敛抽走偏移而突窜（"一口气到底"）。
  // 停滚再淡回；idle 时 scrollFade=1，极限处 convergeAtExtreme 仍生效保"滚到底必沉/都出水"。
  scrollFade += ((isScrolling() ? 0 : 1) - scrollFade) * 0.2;
  for (const n of nodes) {
    n.displayZ = n.z; // 波动不再走 displayZ；保持 displayZ=z 供没入判定回退
    const w = activeWaves.get(n.id);
    if (!w) { n._waveZ = 0; continue; }
    const p = (now - w.start) / w.dur;
    if (p >= 1) { activeWaves.delete(n.id); n._waveZ = 0; continue; }
    const raw = w.dir * w.amp * Math.sin(p * Math.PI);  // 钟形：0 → ±本次幅度 → 0
    n._waveZ = convergeAtExtreme(raw, ext) * scrollFade; // 极限收敛越线方向(保滚到底必沉) × 滚动淡出(滚动时匀速)
  }
}
