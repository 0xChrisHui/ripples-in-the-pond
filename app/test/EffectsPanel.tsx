'use client';

import { useMemo, useState } from 'react';
import {
  EFFECTS_META,
  DESKTOP_EFFECTS,
  type EffectsConfig,
} from '@/src/components/archipelago/effects-config';
import { setPondTilt } from '@/src/components/archipelago/hooks/pond/use-pond-tilt';

interface Props {
  effects: EffectsConfig;
  onChange: (next: EffectsConfig) => void;
}

// 8-F F0 — "水塘推荐"预设：开池内入围项、关星空遗产（aurora/stars/comet/perspective）。
// 只对当前 EffectsConfig 里存在的 key 生效，随 lane 陆续加 flag 自动点亮。
const RECOMMENDED_ON = [
  'bgRipples', 'sphereRipple', 'layerWave2', 'fog', 'focus', 'tilt',
  'waterRipple', 'waterDrop', 'bobbing', 'dropShimmer', 'sphereSheen',
  'caustics', 'filmGrain', 'pondLights', 'drops', 'pondShadow', 'pondEdge',
  'springBack', 'viscous', 'audioPulse', 'beatRipple', 'echoRipple', 'playWaves',
  'waterWake', 'dragWake', 'hoverRipple', 'waterMoon', 'groupWave', 'navPond',
  'tide', 'clickSplash', 'splashIntro',
];
const RECOMMENDED_OFF = ['aurora', 'stars', 'comet', 'perspective', 'gradientGlow'];

/**
 * v39 / Phase 8-F F0 — 右下角浮动 effects 控制面板。
 * 默认折叠（仅 FX 计数按钮）；展开后按 group 分组折叠 + 3 预设按钮 + 机位 slider。
 * 每个 effect 切换后立即同步到 URL（由父组件 onChange 负责）。
 */
export default function EffectsPanel({ effects, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [tilt, setTilt] = useState(1);
  // waterRippleScale 是数值（非开关），按 EFFECTS_META 的布尔 flag 计数
  const enabledCount = EFFECTS_META.filter((m) => effects[m.key]).length;

  const groups = useMemo(() => {
    const m = new Map<string, typeof EFFECTS_META>();
    for (const meta of EFFECTS_META) {
      const arr = m.get(meta.group) ?? [];
      arr.push(meta);
      m.set(meta.group, arr);
    }
    return Array.from(m.entries());
  }, []);

  const applyPreset = (kind: 'base' | 'pond' | 'stress') => {
    if (kind === 'base') return onChange({ ...DESKTOP_EFFECTS });
    if (kind === 'stress') {
      const all = { ...effects };
      // waterRippleScale 是数值 flag，全开压测时给最大强度，其余布尔置 true
      (Object.keys(all) as Array<keyof EffectsConfig>).forEach((k) => {
        if (typeof all[k] === 'boolean') all[k] = true as never;
      });
      all.waterRippleScale = 30;
      return onChange(all);
    }
    const next: EffectsConfig = { ...DESKTOP_EFFECTS };
    (Object.keys(next) as Array<keyof EffectsConfig>).forEach((k) => {
      if (typeof next[k] !== 'boolean') return;  // 跳过 waterRippleScale 数值键
      if (RECOMMENDED_OFF.includes(k)) next[k] = false as never;
      else if (RECOMMENDED_ON.includes(k)) next[k] = true as never;
    });
    onChange(next);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[70]">
      <button
        type="button"
        className="rounded bg-black/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/70 transition hover:text-white"
        onClick={() => setOpen((o) => !o)}
      >
        FX · {enabledCount}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 max-h-[70vh] w-72 overflow-y-auto rounded border border-white/10 bg-black/85 p-3 backdrop-blur-sm">
          <div className="mb-2 flex gap-1">
            {([['base', '现状基准'], ['pond', '水塘推荐'], ['stress', '全开压测']] as const).map(
              ([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => applyPreset(k)}
                  className="flex-1 rounded border border-white/10 bg-white/5 px-1 py-1 text-[9px] text-white/70 transition hover:text-white"
                >
                  {label}
                </button>
              ),
            )}
          </div>

          <label className="mb-2 flex items-center gap-2 py-1 text-[10px] text-white/60">
            <span className="w-16 shrink-0 uppercase tracking-[0.1em] text-white/40">机位 {tilt.toFixed(2)}</span>
            <input
              type="range"
              min={0.25}
              max={1}
              step={0.05}
              value={tilt}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTilt(v);
                setPondTilt(v);
              }}
              className="flex-1"
            />
          </label>

          {/* P8-A — 水波强度 slider（仅 waterRipple 开时生效；数值 flag 不进复选框） */}
          <label className="mb-2 flex items-center gap-2 py-1 text-[10px] text-white/60">
            <span className="w-16 shrink-0 uppercase tracking-[0.1em] text-white/40">水波 {effects.waterRippleScale}</span>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={effects.waterRippleScale}
              onChange={(e) => onChange({ ...effects, waterRippleScale: Number(e.target.value) })}
              className="flex-1"
            />
          </label>

          {groups.map(([group, metas]) => {
            const isCol = collapsed[group];
            return (
              <div key={group} className="mb-1">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [group]: !c[group] }))}
                  className="flex w-full items-center justify-between py-1 text-[9px] uppercase tracking-[0.18em] text-white/40 hover:text-white/70"
                >
                  <span>{group}</span>
                  <span>{isCol ? '▸' : '▾'}</span>
                </button>
                {!isCol && metas.map((m) => (
                  <label
                    key={m.key}
                    className="flex cursor-pointer items-center gap-2 py-0.5 pl-2 text-[11px] text-white/70 hover:text-white"
                  >
                    <input
                      type="checkbox"
                      checked={effects[m.key]}
                      onChange={(e) => onChange({ ...effects, [m.key]: e.target.checked })}
                      className="h-3 w-3 cursor-pointer"
                    />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
