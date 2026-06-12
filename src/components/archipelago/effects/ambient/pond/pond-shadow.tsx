'use client';

import { useMemo } from 'react';
import { usePondTilt } from '../../../hooks/pond/use-pond-tilt';

/**
 * 浮影暗斑 (P8-B §2.12 pondShadow) — 2-4 块大暗椭圆贴背景层（水面浮影/暗流斑），
 * 给"球 = 水面漂浮物"提供尺度锚。纯抽象，无任何具象植物/生物轮廓。
 *
 * 机位：ry = rx × usePondTilt()（与涟漪共享压扁比，slider 响应）。
 * 位置：百分比定位 + 避开视口中央 40%（球群主区）；极慢漂（120-180s translate ±12px + rotate ±2°）。
 * 挂载分层（§0.7）：标注=水面层（理想态进 zoomG 随 zoom）；Wave 2 前沙盒挂背景层（不随 zoom），见下注释。
 *
 * pointer-events:none，z 在球之下、BackgroundRipples 之上。
 */

interface Blob {
  /** 视口百分比定位（避开中央 40%：x/y 落在 0-30 或 70-100 区间） */
  leftPct: number;
  topPct: number;
  rx: number;        // px（无 viewBox，user unit = CSS px）
  anim: string;      // 错相位 keyframe 名
  delay: string;
}

// 固定一组（mount 时随机一次即可，避免每帧抖动）：4 块，分布四角外缘避开中央
function makeBlobs(): Blob[] {
  const slots = [
    { leftPct: 14, topPct: 18 },
    { leftPct: 82, topPct: 26 },
    { leftPct: 22, topPct: 80 },
    { leftPct: 78, topPct: 74 },
  ];
  const anims = ['pondshadow-drift-a', 'pondshadow-drift-b', 'pondshadow-drift-c', 'pondshadow-drift-d'];
  return slots.map((s, i) => ({
    leftPct: s.leftPct,
    topPct: s.topPct,
    rx: 90 + Math.random() * 60, // 90-150
    anim: anims[i % anims.length],
    delay: `-${Math.round(Math.random() * 60)}s`,
  }));
}

export default function PondShadow() {
  const tilt = usePondTilt();
  const blobs = useMemo(makeBlobs, []);

  // keyframes 在 app/pond-effects.css「Lane B」区块（pondshadow-drift-a..d）
  return (
    <>
      {/* 水面层（§0.7）：理想态应进 zoomG 随 zoom 缩放；Wave 2 前沙盒先挂背景层（镜头层，不随 zoom）。 */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {blobs.map((b, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${b.leftPct}%`,
              top: `${b.topPct}%`,
              transform: 'translate(-50%, -50%)',
              animation: `${b.anim} ${120 + i * 18}s ease-in-out infinite`,
              animationDelay: b.delay,
              willChange: 'transform',
            }}
          >
            <svg
              width={b.rx * 2}
              height={b.rx * tilt * 2}
              style={{ display: 'block', transform: 'translate(-50%, -50%)' }}
            >
              <ellipse
                cx={b.rx}
                cy={b.rx * tilt}
                rx={b.rx}
                ry={b.rx * tilt}
                fill="#0A1F1A"
                stroke="var(--pond-ripple)"
                strokeOpacity={0.1}
                strokeWidth={1}
              />
            </svg>
          </div>
        ))}
      </div>
    </>
  );
}
