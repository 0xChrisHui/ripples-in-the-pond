'use client';

import { useState } from 'react';
import { DEFAULT_BUBBLE_TUNING, getBubbleTuning, resetBubbleTuning, setBubbleTuning, type BubbleTuning } from './bubble-tuning';

/** /test4 控制台里的气泡调参（P20 Step 3，D2 目验时用）；改动写模块级单例，气泡每帧直读。 */
const ROWS: Array<{ key: keyof BubbleTuning; label: string; min: number; max: number; step: number }> = [
  { key: 'size', label: '大小', min: 0.5, max: 2.5, step: 0.05 },
  { key: 'opacity', label: '亮度', min: 0.2, max: 2, step: 0.05 },
  { key: 'speed', label: '上升速度', min: 0.4, max: 2.5, step: 0.05 },
  { key: 'interval', label: '串间隔', min: 0.1, max: 3, step: 0.05 },
  { key: 'count', label: '每串最多', min: 3, max: 8, step: 1 },
];

export default function BubblePanel() {
  const [values, setValues] = useState<BubbleTuning>(getBubbleTuning);
  const update = (key: keyof BubbleTuning, v: number) => {
    setBubbleTuning({ [key]: v });
    setValues(getBubbleTuning());
  };
  return (
    <div data-pond-ui="true" className="pointer-events-auto w-48 rounded border border-white/10 bg-black/85 p-3 text-[11px] text-white/70 backdrop-blur-sm">
      <div className="mb-1 tracking-wide text-white/80">池塘气泡</div>
      {ROWS.map((r) => (
        <label key={r.key} className="mb-1 block">
          <span className="flex justify-between"><span>{r.label}</span><span className="text-white/40">{values[r.key]}</span></span>
          <input type="range" className="w-full" min={r.min} max={r.max} step={r.step} value={values[r.key]}
            onChange={(e) => update(r.key, Number(e.target.value))} />
        </label>
      ))}
      <button type="button" className="mt-1 text-white/50 underline"
        onClick={() => { resetBubbleTuning(); setValues({ ...DEFAULT_BUBBLE_TUNING }); }}>恢复默认</button>
    </div>
  );
}
