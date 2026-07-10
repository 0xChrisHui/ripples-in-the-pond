'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  getLifeTuning,
  setLifeTuning,
  saveLifeTuning,
  resetLifeTuning,
  subscribeLifeTuning,
  DEFAULT_LIFE_TUNING,
  type LifeTuning,
} from './life-tuning';

/**
 * P8-L 生命感参数板（范式同 RippleSpikePanel）。
 * 滑块分 5 组：全局呼吸 / 运动无序 / 形态灵动 / 涟漪耦合 / 呈现无序。
 * L0a 基建步：所有幅度类默认 0，滑块可拖但暂无消费方（后续 L 线接入）。
 */
type Slider = { key: keyof LifeTuning; label: string; min: number; max: number; step: number };
type Group = { title: string; sliders: ReadonlyArray<Slider> };

const GROUPS: ReadonlyArray<Group> = [
  {
    title: '全局呼吸',
    sliders: [
      { key: 'lifeEnvAmount', label: '呼吸深度', min: 0, max: 0.6, step: 0.02 },
      { key: 'lifeEnvPeriod', label: '呼吸周期(秒)', min: 8, max: 60, step: 1 },
    ],
  },
  {
    title: '运动无序',
    sliders: [
      { key: 'wheelAmpVar', label: '滚轮·幅度差', min: 0, max: 0.6, step: 0.02 },
      { key: 'wheelLagVar', label: '滚轮·时滞差', min: 0, max: 0.8, step: 0.02 },
      { key: 'parVarAmp', label: '视差·幅度差', min: 0, max: 0.5, step: 0.02 },
      { key: 'parVarAngle', label: '视差·转角差', min: 0, max: 0.35, step: 0.01 },
      { key: 'flowStrength', label: '流场强度', min: 0, max: 0.15, step: 0.005 },
      { key: 'flowScale', label: '流场尺度', min: 0.002, max: 0.02, step: 0.001 },
      { key: 'flowSpeed', label: '流场速度', min: 0.02, max: 0.3, step: 0.01 },
      { key: 'shiverInterval', label: '颤动间隔(秒)', min: 5, max: 120, step: 1 },
      { key: 'shiverAmp', label: '颤动幅度', min: 0, max: 0.12, step: 0.005 },
    ],
  },
  {
    title: '形态灵动',
    sliders: [
      { key: 'edgeWaveAmp', label: '边缘波幅', min: 0, max: 0.15, step: 0.005 },
      { key: 'edgeWaveFreq', label: '边缘波数', min: 3, max: 9, step: 1 },
      { key: 'edgeWaveSpeed', label: '边缘转速', min: 0, max: 2, step: 0.05 },
      { key: 'edgeSoft', label: '边缘虚化', min: 0, max: 0.06, step: 0.002 },
      { key: 'exciteGain', label: '激励增益', min: 0, max: 3, step: 0.05 },
      { key: 'exciteDecay', label: '激励衰减(秒)', min: 0.2, max: 3, step: 0.05 },
      { key: 'jellyAmount', label: '果冻感', min: 0, max: 0.4, step: 0.02 },
    ],
  },
  {
    title: '涟漪耦合',
    sliders: [
      { key: 'wakeSphereForce', label: '尾波推力', min: 0, max: 0.5, step: 0.02 },
      { key: 'wakeDepthFalloff', label: '推力衰减深', min: 0.1, max: 1, step: 0.02 },
    ],
  },
  {
    title: '呈现无序',
    sliders: [
      { key: 'flickerAmount', label: '隐现幅度', min: 0, max: 0.85, step: 0.02 },
      { key: 'flickerSpeed', label: '隐现速度', min: 0.05, max: 0.6, step: 0.01 },
      { key: 'flickerDepthBias', label: '隐现·深度偏', min: 0, max: 1, step: 0.02 },
      { key: 'haloBreathAmp', label: '光晕呼吸幅', min: 0, max: 0.5, step: 0.02 },
      { key: 'haloBreathSpeed', label: '光晕呼吸速', min: 0.05, max: 0.8, step: 0.02 },
    ],
  },
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
        onChange={(e) => setLifeTuning({ [s.key]: parseFloat(e.target.value) } as Partial<LifeTuning>)}
        className="w-full cursor-pointer accent-white/70"
      />
    </label>
  );
}

export default function LifePanel() {
  const t = useSyncExternalStore(subscribeLifeTuning, getLifeTuning, () => DEFAULT_LIFE_TUNING);
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    saveLifeTuning();
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
        <span className="tracking-wide">生命感参数</span>
        <span className="text-white/40">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-1 max-h-[55vh] overflow-y-auto pr-0.5">
          {GROUPS.map((g) => (
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
              onClick={resetLifeTuning}
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
