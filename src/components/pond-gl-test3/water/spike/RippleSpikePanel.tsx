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
 * /test3 波纹/运动参数板 —— 仅保留与裁剪后视觉控制台 7 项对应的参数组：
 *   波纹/深度折射 → 扭曲水面；运动 → GL球浮沉(出入水)；月光焦散 / 可见塘底 / 月光倒影。
 * 已删（对应控制台已下架项）：球投影(K4) / 水面缩放(K6) / 漂浮微光(K8) / 水生植物(K9) / 水位标尺柱(K12)。
 * 删的只是滑块 UI；ripple-tuning store 字段仍在（shader 读默认值），故安全无副作用。
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
  { key: 'waveAmpMin', label: '幅度·下限', min: 0, max: 0.5, step: 0.01 },  // 球浮动：单次沉浮幅度区间（每次随机取）
  { key: 'waveAmpMax', label: '幅度·上限', min: 0, max: 0.6, step: 0.01 },
  { key: 'waveSpeedMin', label: '速度·下限', min: 0.2, max: 4, step: 0.05 }, // 球浮动：单次沉浮速度区间（越大越快=时长越短）
  { key: 'waveSpeedMax', label: '速度·上限', min: 0.2, max: 4, step: 0.05 },
  { key: 'bobScale', label: '触发频率', min: 0.2, max: 3, step: 0.1 },       // 多久有一颗球开始波动
  { key: 'scrollStep', label: '滚轮步长', min: 0.01, max: 0.2, step: 0.005 }, // /test3 单次滚轮深度位移封顶（小=出入水更慢更分明）
];

const DRIFT_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'drift', label: '飘动幅度', min: 0, max: 0.6, step: 0.01 },        // 球随机游走（只动 x/y，与沉浮正交）
  { key: 'wavePush', label: '涟漪推力', min: 0, max: 8, step: 0.1 },        // 点击/切组涟漪推水下球
  { key: 'wavePushDepth', label: '推力衰减深', min: 0.1, max: 1, step: 0.02 },
];

const DOF_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'dofStrength', label: '景深强度', min: 0, max: 1, step: 0.05 }, // 焦平面景深虚化整体强弱（往小=更弱；0=全清晰）
];

const DEPTH_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'pondDepth', label: '塘深', min: 0.1, max: 1, step: 0.02 },
  { key: 'refrExp', label: '折射·深度指数', min: 0.3, max: 3, step: 0.1 },
  { key: 'moonExp', label: '月光·深度指数', min: 0.3, max: 3, step: 0.1 },
];

const CAUSTICS_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'causticsStrength', label: '焦散强度', min: 0, max: 1, step: 0.02 },
];

const PONDFLOOR_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'pondFloorStrength', label: '塘底浓度', min: 0, max: 1, step: 0.02 },
];

const MOONREFLECT_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'moonReflectStrength', label: '月光倒影', min: 0, max: 1, step: 0.02 },
];

const MOONBALL_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'ballLightAbove', label: '水上球衰减', min: 0, max: 1, step: 0.02 }, // 月光(焦散/倒影取高者)对水上球增亮，0–100%
  { key: 'ballLightBelow', label: '水下球衰减', min: 0, max: 1, step: 0.02 }, // 对水下球增亮，0–100%
  { key: 'waveOnBall', label: '水下球波纹', min: 0, max: 1.5, step: 0.05 },   // 水下球水面波纹强度（提升水下感）
];

const PETAL_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'petalCount', label: '花瓣数量', min: 0, max: 40, step: 1 },
  { key: 'petalSize', label: '花瓣大小', min: 0.3, max: 3, step: 0.05 },
  { key: 'petalSens', label: '花瓣灵敏度', min: 0, max: 3, step: 0.05 },     // 各种运动幅度倍率
  { key: 'petalDrag', label: '触发·划水', min: 0, max: 3, step: 0.05 },      // 各来源对花瓣的触发强度（0=该来源不影响）
  { key: 'petalClick', label: '触发·点击', min: 0, max: 3, step: 0.05 },
  { key: 'petalWave', label: '触发·背景涟漪', min: 0, max: 3, step: 0.05 },
  { key: 'petalSplash', label: '触发·球出入水', min: 0, max: 3, step: 0.05 },
];

const MOTES_SLIDERS: ReadonlyArray<Slider> = [
  { key: 'motesCount', label: '微光密度', min: 0, max: 1, step: 0.02 },
  { key: 'motesSize', label: '微光点径', min: 0.5, max: 6, step: 0.5 },
  { key: 'motesOpacity', label: '微光透明度', min: 0, max: 1, step: 0.02 },
  { key: 'motesDrift', label: '微光游走', min: 0, max: 1, step: 0.02 },
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
          <div className="mb-1 text-[10px] uppercase tracking-wider text-white/30">波纹（扭曲水面）</div>
          {RIPPLE_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">运动（球浮沉·出入水）</div>
          {MOTION_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">球飘动+涟漪推（需开开关）</div>
          {DRIFT_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">焦平面景深（需开开关）</div>
          {DOF_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">深度折射（扭曲水面·水下）</div>
          {DEPTH_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">月光焦散</div>
          {CAUSTICS_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">可见塘底</div>
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

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">月光倒影</div>
          {MOONREFLECT_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">月光·对球增亮(衰减)</div>
          {MOONBALL_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">水面花瓣（需开开关）</div>
          {PETAL_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">漂浮微光（需开开关）</div>
          {MOTES_SLIDERS.map((s) => <SliderRow key={s.key} s={s} value={t[s.key]} />)}

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
