'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  getRippleTuning,
  setRippleTuning,
  saveRippleTuning,
  resetRippleTuning,
  subscribeRippleTuning,
  DEFAULT_RIPPLE_TUNING,
  type RippleTuning,
} from './ripple-tuning';

/**
 * H1 spike 波纹参数面板（右下角，H6 参数板的提前 spike 版）。
 * 拖动即时改 RttSpike 的涟漪 uniform；"保存"写 localStorage 刷新保留。rtt flag 开时才挂。
 */
const SLIDERS: ReadonlyArray<{
  key: keyof RippleTuning; label: string; min: number; max: number; step: number;
}> = [
  { key: 'damping', label: '阻尼(持续)', min: 0.95, max: 0.999, step: 0.001 },
  { key: 'perturb', label: '折射强度', min: 0, max: 0.12, step: 0.002 },
  { key: 'dropMove', label: '滴水·移动', min: 0, max: 0.05, step: 0.001 },
  { key: 'dropClick', label: '滴水·点击', min: 0, max: 0.4, step: 0.005 },
  { key: 'dropRadius', label: '滴水半径', min: 0.01, max: 0.15, step: 0.005 },
  { key: 'specular', label: '高光', min: 0, max: 1.5, step: 0.02 },
];

export default function RippleSpikePanel() {
  const t = useSyncExternalStore(subscribeRippleTuning, getRippleTuning, () => DEFAULT_RIPPLE_TUNING);
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    saveRippleTuning();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  return (
    <div className="pointer-events-auto fixed bottom-3 right-3 z-50 w-56 rounded border border-white/10 bg-black/85 p-3 text-[11px] text-white/70 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 flex w-full items-center justify-between text-white/80"
      >
        <span className="tracking-wide">波纹参数 (H1 spike)</span>
        <span className="text-white/40">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <>
          {SLIDERS.map((s) => (
            <label key={s.key} className="mb-1.5 block">
              <div className="mb-0.5 flex justify-between">
                <span>{s.label}</span>
                <span className="text-white/40">{t[s.key].toFixed(3)}</span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={t[s.key]}
                onChange={(e) => setRippleTuning({ [s.key]: parseFloat(e.target.value) } as Partial<RippleTuning>)}
                className="w-full cursor-pointer accent-white/70"
              />
            </label>
          ))}

          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={onSave}
              className="flex-1 rounded border border-white/15 bg-white/5 py-1 text-white/80 hover:bg-white/10"
            >
              {saved ? '已保存 ✓' : '保存'}
            </button>
            <button
              type="button"
              onClick={resetRippleTuning}
              className="rounded border border-transparent px-2 py-1 text-white/40 hover:text-white/70"
            >
              重置
            </button>
          </div>
        </>
      )}
    </div>
  );
}
