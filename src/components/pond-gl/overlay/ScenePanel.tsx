'use client';

import { useState } from 'react';
import type { GLFlags } from '../gl-flags';

/**
 * G5 控制台（左下角）— 逐层开关所有视觉，默认纯净夜塘。
 * GL 层（基调/球/水面 + deep·black）+ 背景氛围（星空/极光/雾/背景涟漪/彗星，默认全关）。
 */
export interface SceneFx {
  stars: boolean;
  aurora: boolean;
  fog: boolean;
  bgRipples: boolean;
  comet: boolean;
}

interface Props {
  glFlags: GLFlags;
  onGl: (patch: Partial<GLFlags>) => void;
  fx: SceneFx;
  onFx: (patch: Partial<SceneFx>) => void;
}

const FX_ROWS: ReadonlyArray<{ key: keyof SceneFx; label: string }> = [
  { key: 'stars', label: '星空' },
  { key: 'aurora', label: '极光' },
  { key: 'fog', label: '雾' },
  { key: 'bgRipples', label: '背景涟漪' },
  { key: 'comet', label: '彗星' },
];

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 hover:text-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3 w-3 cursor-pointer"
      />
      <span>{label}</span>
    </label>
  );
}

export default function ScenePanel({ glFlags, onGl, fx, onFx }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="pointer-events-auto fixed bottom-3 left-3 z-50 w-44 rounded border border-white/10 bg-black/85 p-3 text-[11px] text-white/70 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 flex w-full items-center justify-between text-white/80"
      >
        <span className="tracking-wide">视觉控制台</span>
        <span className="text-white/40">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <>
          <div className="mb-1 mt-1 text-[10px] uppercase tracking-wider text-white/30">GL 层</div>
          <Row label="基调" checked={glFlags.glBase} onChange={(v) => onGl({ glBase: v })} />
          <Row label="背景图" checked={glFlags.bgImage} onChange={(v) => onGl({ bgImage: v })} />
          <Row label="GL 球" checked={glFlags.glSpheres} onChange={(v) => onGl({ glSpheres: v })} />
          <Row label="水面" checked={glFlags.water} onChange={(v) => onGl({ water: v })} />
          <div className="mt-1 flex gap-1">
            {(['deep', 'black'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onGl({ artDir: d })}
                className={[
                  'flex-1 rounded border py-0.5 text-[10px]',
                  glFlags.artDir === d ? 'border-white/20 bg-white/10 text-white/80' : 'border-transparent text-white/40 hover:text-white/70',
                ].join(' ')}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="mb-1 mt-2 text-[10px] uppercase tracking-wider text-white/30">背景氛围</div>
          {FX_ROWS.map((r) => (
            <Row key={r.key} label={r.label} checked={fx[r.key]} onChange={(v) => onFx({ [r.key]: v } as Partial<SceneFx>)} />
          ))}
        </>
      )}
    </div>
  );
}
