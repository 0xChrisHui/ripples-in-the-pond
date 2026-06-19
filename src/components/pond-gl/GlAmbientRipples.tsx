'use client';

import { useEffect } from 'react';

/**
 * GL 沙盒「背景涟漪」spawner —— 复刻 /test 的 BackgroundRipples **推球部分**（去掉 SVG 白圈，GL 里水面涟漪本身就是视觉）。
 *
 * 定时在随机位置派发 `bg-ripple:wave`（节奏/尺寸/时长 1:1 抄 BackgroundRipples）：
 *   - use-gl-sim 订阅 → 写 wavesRef → pushGlSpheresByWaves 推**水下球**（深度衰减，见 sphereDrift 链路）；
 *   - WaterDistort 订阅 → 在该处起一道水面涟漪（= GL 版"背景涟漪"的可见形态）。
 * active(=sphereDrift) 关时整个 effect 不跑、零监听、零派发 → 与现状逐字一致。
 * 这是之前"涟漪推球几乎无感"的真正根因：GL 去 SVG 后丢了这条**持续的环境涟漪流**，球只在点击/切组时才被推。
 */
export default function GlAmbientRipples({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers: number[] = [];
    let lastX = window.innerWidth / 2;
    let lastY = window.innerHeight / 2;

    const spawn = (near: boolean) => {
      if (cancelled) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const x = near ? Math.max(20, Math.min(w - 20, lastX + (Math.random() - 0.5) * 300)) : Math.random() * w;
      const y = near ? Math.max(20, Math.min(h - 20, lastY + (Math.random() - 0.5) * 300)) : Math.random() * h;
      lastX = x; lastY = y;
      const size = 220 + Math.random() * 260;      // 涟漪覆盖半径（同 BackgroundRipples）
      const duration = 3.5 + Math.random() * 1.5;  // 秒：够推力环按水波速度(SphereInstances)扩满 size 即可（旧 14–20s 是慢扩遗留，现按水波速度同步高光）
      window.dispatchEvent(new CustomEvent('bg-ripple:wave', { detail: { x, y, size, duration } }));
    };

    // tick 节奏复刻 BackgroundRipples：每 ~2.4–3.5s 一道随机，45% 概率再补 1–2 道"就近"涟漪
    const tick = () => {
      if (cancelled) return;
      if (document.hidden) { timers.push(window.setTimeout(tick, 2400)); return; }
      spawn(false);
      if (Math.random() < 0.45) {
        const extra = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < extra; i++) {
          timers.push(window.setTimeout(() => spawn(true), (240 + Math.random() * 360) * (i + 1)));
        }
      }
      timers.push(window.setTimeout(tick, 2400 + Math.random() * 1100));
    };
    timers.push(window.setTimeout(tick, 600));

    return () => { cancelled = true; timers.forEach((t) => window.clearTimeout(t)); };
  }, [active]);

  return null;
}
