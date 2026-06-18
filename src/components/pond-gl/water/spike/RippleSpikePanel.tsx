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
 * H6 波纹/运动参数板（仿 TunePanel；rtt 或 H2+ 扭曲水面开时挂）。
 * 拖动即时改 WaterDistort/RttSpike 的涟漪 uniform + sphere-motion 的浮沉；"保存"写 localStorage。
 * 定位由父级 flex 容器给（与 TunePanel 同栏堆叠，不再各自 fixed → 不重叠）。
 */
type Slider = { key: keyof RippleTuning; label: string; min: number; max: number; step: number };

const RIPPLE_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'damping', label: '阻尼(持续)', min: 0.95, max: 0.999, step: 0.001 },
  { key: 'refract', label: '折射强度', min: 0, max: 3, step: 0.05 },
  { key: 'dropMove', label: '滴水·移动', min: 0, max: 0.05, step: 0.001 },
  { key: 'dropClick', label: '滴水·点击', min: 0, max: 0.4, step: 0.005 },
  { key: 'dropRadius', label: '滴水半径', min: 0.01, max: 0.15, step: 0.005 },
  { key: 'specular', label: '高光', min: 0, max: 1.5, step: 0.02 },
  { key: 'trail', label: '拖尾强度', min: 0, max: 0.4, step: 0.005 },
  { key: 'splash', label: '溅起强度', min: 0, max: 0.5, step: 0.005 },
  { key: 'ambient', label: '常驻微波', min: 0, max: 0.06, step: 0.002 },
];

const MOTION_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'bobAmp', label: '浮沉幅度', min: 0, max: 0.2, step: 0.005 },
  { key: 'bobScale', label: '浮沉频率', min: 0.2, max: 3, step: 0.1 },
  { key: 'focusMargin', label: '焦点露出', min: 0, max: 0.2, step: 0.005 },
];

const DEPTH_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'pondDepth', label: '塘深', min: 0.1, max: 1, step: 0.02 },
  { key: 'refrExp', label: '折射·深度指数', min: 0.3, max: 3, step: 0.1 },
  { key: 'moonExp', label: '月光·深度指数', min: 0.3, max: 3, step: 0.1 },
];

const SHADOW_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'shadowStrength', label: '投影强度', min: 0, max: 1, step: 0.02 },
  { key: 'shadowHeight', label: '投影高度感', min: 0, max: 2.5, step: 0.05 },
];

const CAUSTICS_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'causticsStrength', label: '焦散强度', min: 0, max: 1, step: 0.02 },
];

const ZOOM_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'zoomAmount', label: '缩放幅度', min: 0, max: 1, step: 0.02 },
];

const MOTES_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'motesCount', label: '微光密度', min: 0, max: 1, step: 0.02 },
  { key: 'motesSize', label: '微光点径', min: 0.5, max: 6, step: 0.1 },
  { key: 'motesOpacity', label: '微光透明', min: 0, max: 1, step: 0.02 },
  { key: 'motesDrift', label: '微光游走', min: 0, max: 1, step: 0.02 },
];

const PLANTS_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'plantsCount', label: '睡莲密度', min: 0, max: 1, step: 0.02 },
  { key: 'plantsSize', label: '睡莲大小', min: 0.02, max: 0.14, step: 0.005 },
  { key: 'plantsOpacity', label: '睡莲透明', min: 0, max: 1, step: 0.02 },
  { key: 'plantsSway', label: '睡莲轻晃', min: 0, max: 1, step: 0.02 },
];

const PONDFLOOR_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'pondFloorStrength', label: '塘底暗纹', min: 0, max: 0.2, step: 0.005 },
];

const MOONREFLECT_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'moonReflectStrength', label: '月光倒影', min: 0, max: 1, step: 0.02 },
];

const COLUMNS_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'perspStrength', label: '透视强度', min: 0, max: 0.6, step: 0.01 },
  { key: 'colCount', label: '柱数量', min: 0, max: 1, step: 0.02 },
  { key: 'colHeight', label: '柱高', min: 0.3, max: 2, step: 0.05 },
  { key: 'colWidth', label: '柱宽', min: 0.3, max: 2, step: 0.05 },
  { key: 'colOpacity', label: '柱透明', min: 0, max: 1, step: 0.02 },
];

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
          <div className="mb-1 text-[10px] uppercase tracking-wider text-white/30">波纹</div>
          {RIPPLE_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">运动（球浮沉）</div>
          {MOTION_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">深度模型（K3，需开开关）</div>
          {DEPTH_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">球投影（K4，需开开关）</div>
          {SHADOW_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">月光焦散（K5，需开开关）</div>
          {CAUSTICS_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">水面缩放（K6，需开开关）</div>
          {ZOOM_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">漂浮微光（K8，需开开关）</div>
          {MOTES_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">水生植物（K9，需开开关）</div>
          {PLANTS_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

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

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">月光倒影（K11，需开开关）</div>
          {MOONREFLECT_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">水位标尺柱（K12，需开开关）</div>
          {COLUMNS_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

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
