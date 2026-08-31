'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { P9_ACTIVE_EFFECTS, getP9ParamMeta, type P9Lane } from '../registry';
import { P9_FAMILY_META, P9_LANE_LABEL, type P9TuneDefinition } from './p9-tuning-meta';
import {
  getP9TuningSnapshot, resetP9Tuning, saveP9Tuning,
  setP9EffectValue, setP9FamilyValue, subscribeP9Tuning,
} from './p9-tuning-store';
import { getP9RuntimeStats } from '../runtime/p9-state';
import { getP9SamplerStats } from '../runtime/p9-sampler';
import { getP9PetalBurstFieldCount } from '../consumers/p9-petals';

const lanes: P9Lane[] = ['eclipse', 'motes', 'petals', 'water', 'scene'];
type Slider = P9TuneDefinition;

function SliderRow({ item, value, onChange }: {
  item: Slider; value: number; onChange: (value: number) => void;
}) {
  return (
    <label className="mb-1.5 block">
      <div className="mb-0.5 flex justify-between gap-2">
        <span>{item.label}</span><span className="font-mono text-white/40">{value.toFixed(2)}</span>
      </div>
      <input type="range" min={item.min} max={item.max} step={item.step} value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full cursor-pointer accent-emerald-100/70" />
    </label>
  );
}

/** P9 v4 双层调参：先调同族共享动力学，再调最终 33 键的独有参数。 */
export default function P9TuningPanel() {
  const tuning = useSyncExternalStore(subscribeP9Tuning, getP9TuningSnapshot, getP9TuningSnapshot);
  const [open, setOpen] = useState(false);
  const [lane, setLane] = useState<P9Lane>('eclipse');
  const [effectId, setEffectId] = useState('FX01');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const scope = window as Window & { __p9Debug?: { stats: () => unknown } };
    scope.__p9Debug = { stats: () => ({
      runtime: getP9RuntimeStats(), sampler: getP9SamplerStats(), burstFields: getP9PetalBurstFieldCount(),
    }) };
    return () => { delete scope.__p9Debug; };
  }, []);
  const effects = useMemo(() => P9_ACTIVE_EFFECTS.filter((effect) => effect.lane === lane), [lane]);
  const effect = effects.find((item) => item.id === effectId) ?? effects[0];
  const chooseLane = (next: P9Lane) => {
    setLane(next);
    setEffectId(P9_ACTIVE_EFFECTS.find((item) => item.lane === next)?.id ?? '');
  };
  const save = () => {
    saveP9Tuning(); setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };
  return (
    <section className="pointer-events-auto w-64 rounded border border-emerald-100/15 bg-black/90 p-3 text-[11px] text-white/70 backdrop-blur-md">
      <button type="button" onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-white/85">
        <span className="tracking-[0.12em]">P9 v4 · 33 键参数</span>
        <span className="text-white/40">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-2 max-h-[64vh] overflow-y-auto pr-1">
          <div className="mb-2 flex flex-wrap gap-1">
            {lanes.map((item) => (
              <button key={item} type="button" onClick={() => chooseLane(item)}
                className={`rounded border px-2 py-1 ${lane === item ? 'border-emerald-100/30 bg-emerald-100/10 text-white' : 'border-white/5 text-white/45'}`}>
                {P9_LANE_LABEL[item]}
              </button>
            ))}
          </div>
          <p className="mb-1 text-[10px] tracking-[0.16em] text-emerald-100/45">同族共享参数</p>
          {P9_FAMILY_META[lane].map((item) => (
            <SliderRow key={item.key} item={item} value={tuning.family[lane][item.key]}
              onChange={(value) => setP9FamilyValue(lane, item.key, value)} />
          ))}
          <div className="my-2 border-t border-white/10" />
          <p className="mb-1 text-[10px] tracking-[0.16em] text-emerald-100/45">当前效果参数</p>
          <select value={effect?.id ?? ''} onChange={(event) => setEffectId(event.target.value)}
            className="mb-2 w-full rounded border border-white/10 bg-black px-2 py-1.5 text-white/75">
            {effects.map((item) => (
              <option key={item.id} value={item.id}>{item.soundKey === 'space' ? 'Space' : item.soundKey.toUpperCase()} · {item.name}</option>
            ))}
          </select>
          {effect && getP9ParamMeta(effect).map((item) => (
            <SliderRow key={item.key} item={item} value={tuning.effects[effect.id][item.key]}
              onChange={(value) => setP9EffectValue(effect.id, item.key, value)} />
          ))}
          {effect && getP9ParamMeta(effect).length === 0 && <p className="py-2 text-white/35">此效果暂时只使用同族参数。</p>}
          <p className="mt-2 rounded bg-white/[0.04] p-2 text-[10px] leading-relaxed text-white/35">
            月光写入白名单：0 · 水波写入：T / U / V
          </p>
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={save}
              className="flex-1 rounded border border-white/15 bg-white/5 py-1 text-white/80">
              {saved ? '已保存 ✓' : '保存'}
            </button>
            <button type="button" onClick={resetP9Tuning}
              className="rounded px-2 py-1 text-white/45 hover:text-white/75">重置</button>
          </div>
        </div>
      )}
    </section>
  );
}
