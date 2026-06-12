/**
 * v39 effect: 景深雾 (E16) — 远端铺一层半透明白雾遮住远球，模拟体积雾景深
 *
 * ## 接入说明
 * 接入点：src/components/archipelago/Archipelago.tsx
 * 时机：fullscreen 模式下，<section> 内 <SphereCanvas> 之后（叠在球之上）
 * 改动示例：
 *   import FogLayer from './effects/fog-layer';
 *   {effects.fog && <FogLayer opacity={0.06} />}
 *
 * 与其他 effects 冲突：
 * - 与 stars / aurora 同属 E 组环境层，z-index 上 aurora < stars < fog（雾在最上）
 * - 不影响 pointer events（pointer-events: none）
 */
'use client';

interface Props {
  /** 整体雾浓度，默认 0.06；调高会更白，远球更模糊 */
  opacity?: number;
}

export default function FogLayer({ opacity = 0.06 }: Props) {
  // P8-B §2.11 夜霭调色：white → var(--pond-mist)（现状兼容值=白）；
  // 渐变方向反转——水汽贴水面，顶部 0.4× 薄 → 中段 1× → 底部 1.4× 沉底。
  // 用 svg 而非 div 是为了和 BackgroundRipples 同层级语义一致
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[1] h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="fog-vertical" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pond-mist)" stopOpacity={opacity * 0.4} />
          <stop offset="55%" stopColor="var(--pond-mist)" stopOpacity={opacity} />
          <stop offset="100%" stopColor="var(--pond-mist)" stopOpacity={opacity * 1.4} />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#fog-vertical)" />
    </svg>
  );
}
