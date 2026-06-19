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
import { type Slider, SLIDER_GROUPS, SLIDER_GROUPS_TAIL, PONDFLOOR_SLIDERS } from './ripple-panel-config';

/**
 * H6 波纹/运动参数板（仿 TunePanel；rtt 或 H2+ 扭曲水面开时挂）。
 * 拖动即时改 WaterDistort/RttSpike 的涟漪 uniform + sphere-motion 的浮沉；"保存"写 localStorage。
 * 定位由父级 flex 容器给（与 TunePanel 同栏堆叠，不再各自 fixed → 不重叠）。
 */
function SliderRow({ s, value }: { s: Slider; value: number }) {
  return (
    <label className="mb-1.5 block">
      <div className="mb-0.5 flex justify-between">
        <span>{s.label}</span>
        <span className="text-white/40">{value.toFixed(3)}</span>
      </div>
      <input
        type="range"
        min={s.min}
        max={s.max}
        step={s.step}
        value={value}
        onChange={(e) => setRippleTuning({ [s.key]: parseFloat(e.target.value) } as Partial<RippleTuning>)}
        className="w-full cursor-pointer accent-white/70"
      />
    </label>
  );
}

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
    <div className="pointer-events-auto w-56 rounded border border-white/10 bg-black/85 p-3 text-[11px] text-white/70 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-white/80"
      >
        <span className="tracking-wide">波纹/运动参数</span>
        <span className="text-white/40">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-1 max-h-[55vh] overflow-y-auto pr-0.5">
          {SLIDER_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">{g.title}</div>
              {g.sliders.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}
            </div>
          ))}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">可见塘底（K10，需开开关）</div>
          {PONDFLOOR_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}
          <div className="mb-1.5 flex flex-wrap gap-1">
            {['暗矿', '亮沙', '虹彩', '莲花', '星河'].map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setRippleTuning({ pondFloorStyle: i })}
                className={[
                  'rounded border px-1.5 py-0.5 text-[10px]',
                  Math.round(t.pondFloorStyle) === i ? 'border-white/20 bg-white/10 text-white/80' : 'border-transparent text-white/40 hover:text-white/70',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {SLIDER_GROUPS_TAIL.map((g) => (
            <div key={g.title}>
              <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">{g.title}</div>
              {g.sliders.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}
            </div>
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
        </div>
      )}
    </div>
  );
}
