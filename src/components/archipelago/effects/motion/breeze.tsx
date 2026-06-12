'use client';

import { useEffect, useRef, useState } from 'react';
import { syncPhys } from '../../forces/phys-config';

/**
 * Lane C 物理线 F4 — 微风
 *
 * 每 40-90s 一阵风：
 *  ① 一条宽淡碎光带（CSS linear-gradient 窄带，角度随机 ±20°）4-7s 扫过全屏（纯 transform/opacity）；
 *  ② 同时对全体球施加同向微力 2-3s（量级远小于涟漪推力）→ 风停球回稳（springBack 开时回摆）。
 * 施力部分通过 dispatch 'pond:breeze-gust' 事件让 sphere-sim-setup 侧的 breeze-force 模块接管。
 *
 * 自身只渲染一个 fixed overlay 碎光带 div（不碰其它 lane 的 DOM）。
 */

interface Props {
  effects: { breeze: boolean; springBack: boolean; viscous: boolean };
}

interface Gust {
  key: number;
  angle: number; // 扫描角度（deg）
  dur: number;   // 扫描时长（s）
}

const PUSH_MAG = 0.05; // 单帧微力量级（涟漪为 0.18，远小于）

export default function Breeze({ effects }: Props) {
  // Lane C — 任何开关变化都把三物理 flag 广播给 sim（sim 不随 effects 重建，必须实时同步）
  useEffect(() => {
    syncPhys({
      springBack: effects.springBack,
      viscous: effects.viscous,
      breeze: effects.breeze,
    });
  }, [effects.springBack, effects.viscous, effects.breeze]);

  const [gust, setGust] = useState<Gust | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    if (!effects.breeze) return;
    let timer = 0;
    let pushRaf = 0;
    let pushStop = 0;

    const schedule = () => {
      const wait = 40000 + Math.random() * 50000; // 40-90s
      timer = window.setTimeout(fire, wait);
    };

    const fire = () => {
      const angle = -90 + (Math.random() * 40 - 20); // 主方向 ±20°
      const dur = 4 + Math.random() * 3; // 4-7s
      keyRef.current += 1;
      setGust({ key: keyRef.current, angle, dur });

      // 施力 2-3s：把扫描角转成单位方向向量，逐帧 dispatch 微力
      const rad = (angle * Math.PI) / 180;
      const dirX = Math.cos(rad);
      const dirY = Math.sin(rad);
      pushStop = performance.now() + (2000 + Math.random() * 1000);
      const pushLoop = () => {
        if (performance.now() >= pushStop) return;
        window.dispatchEvent(
          new CustomEvent('pond:breeze-gust', { detail: { dirX, dirY, mag: PUSH_MAG } }),
        );
        pushRaf = requestAnimationFrame(pushLoop);
      };
      pushRaf = requestAnimationFrame(pushLoop);

      // 光带扫完后清除并排下一阵
      window.setTimeout(() => setGust(null), dur * 1000);
      schedule();
    };

    schedule();
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(pushRaf);
    };
  }, [effects.breeze]);

  if (!effects.breeze || !gust) return null;

  return (
    <div
      key={gust.key}
      aria-hidden
      className="breeze-band"
      style={{
        // CSS 变量驱动 keyframe（角度/时长随机），动画体在 pond-effects.css Lane C 区块
        ['--breeze-angle' as string]: `${gust.angle}deg`,
        animationDuration: `${gust.dur}s`,
      }}
    />
  );
}
