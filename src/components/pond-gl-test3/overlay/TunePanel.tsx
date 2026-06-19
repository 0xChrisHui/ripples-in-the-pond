'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  getTuning,
  setTuning,
  saveTuning,
  resetTuning,
  subscribeTuning,
  DEFAULT_TUNING,
  type SphereTuning,
} from '../spheres/sphere-tuning';

/**
 * G4 调色面板 — 实时调 GL 球的亮度/对比度/饱和度/光晕/浓度。
 * 拖动即时预览（写 tuning store，SphereInstances 每帧读）；"保存"写 localStorage 刷新保留。
 * 定位由父级 flex 容器给（与波纹/运动参数板同栏堆叠，H6 起不再各自 fixed → 不重叠）。
 */
const SLIDERS: ReadonlyArray<{
  key: keyof SphereTuning; label: string; min: number; max: number; step: number;
}> = [
  { key: 'brightness', label: '亮度', min: 0.3, max: 2, step: 0.01 },
  { key: 'contrast', label: '对比度', min: 0.3, max: 2.5, step: 0.01 },
  { key: 'saturation', label: '饱和度', min: 0, max: 2, step: 0.01 },
  { key: 'halo', label: '光晕', min: 0, max: 3, step: 0.01 },
  { key: 'fill', label: '浓度', min: 0.4, max: 1.6, step: 0.01 },
];

export default function TunePanel() {
  const t = useSyncExternalStore(subscribeTuning, getTuning, () => DEFAULT_TUNING);
  const [open, setOpen] = useState(true);
  const [savedAt, setSavedAt] = useState(false);

  const onSave = () => {
    saveTuning();
    setSavedAt(true);
    window.setTimeout(() => setSavedAt(false), 1200);
  };

  return (
    <div className="pointer-events-auto w-56 rounded border border-white/10 bg-black/85 p-3 text-[11px] text-white/70 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 flex w-full items-center justify-between text-white/80"
      >
        <span className="tracking-wide">GL 球调色</span>
        <span className="text-white/40">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <>
          {SLIDERS.map((s) => (
            <label key={s.key} className="mb-1.5 block">
              <div className="mb-0.5 flex justify-between">
                <span>{s.label}</span>
                <span className="text-white/40">{t[s.key].toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={t[s.key]}
                onChange={(e) => setTuning({ [s.key]: parseFloat(e.target.value) } as Partial<SphereTuning>)}
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
              {savedAt ? '已保存 ✓' : '保存'}
            </button>
            <button
              type="button"
              onClick={resetTuning}
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
