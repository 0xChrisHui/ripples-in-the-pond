'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  DEFAULT_BUBBLE_TUNING, enableTuningStorage, getBubbleTuning, getUiState, requestBurst, resetBubbleTuning, setBubbleTuning, subscribeUi,
  type BubbleTuning, type UiState,
} from '../bubble-tuning';
import { LAB_PATH } from '@/src/components/pond-shell/transition/types';
import { GROUPS, type Row } from './tuning-meta';

const BURST_TEXT: Record<UiState['burst'], string> = { idle: '空闲', queued: '排队中', running: '进行中', failed: '没有空位' };
const NOTE_TEXT: Record<UiState['note'], string> = { idle: '无', surface: '泡在水面，等出字', showing: '显示中' };

/** 按钮文字随本次请求的状态变化：点了之后马上有反应，不再是静止的按钮。 */
function burstLabel(base: string, kind: 'plain' | 'note', ui: UiState): string {
  if (ui.kind !== kind) return base;
  if (ui.burst === 'queued') return '排队中…';
  if (ui.burst === 'running') return '进行中…';
  if (ui.burst === 'failed') return '没有空位，再点一次';
  return base;
}

/** 池塘气泡 + 手记的完整调参控制台（/test5 与沙盒）。写模块级单例，气泡与手记每帧直读。 */
function Field({ row, value, onChange }: { row: Row; value: string | number; onChange: (v: string | number) => void }) {
  if (row.kind === 'color') {
    return (
      <label className="mb-1 flex items-center justify-between"><span>{row.label}</span>
        <input type="color" value={String(value)} onChange={(e) => onChange(e.target.value)} /></label>
    );
  }
  if (row.kind === 'bool') {
    return (
      <label className="mb-1 flex items-center justify-between"><span>{row.label}</span>
        <input type="checkbox" checked={value === 1} onChange={(e) => onChange(e.target.checked ? 1 : 0)} /></label>
    );
  }
  return (
    <label className="mb-1 block">
      <span className="flex justify-between"><span>{row.label}</span><span className="text-white/40">{value}</span></span>
      <input type="range" className="w-full" min={row.min} max={row.max} step={row.step} value={Number(value)}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

const BTN = 'rounded border border-white/20 px-2 py-1';

export default function BubblePanel() {
  const [values, setValues] = useState<BubbleTuning>(() => {
    if (window.location.pathname === LAB_PATH) enableTuningStorage(); // 只有 /test5 读写本地存储
    return { ...getBubbleTuning() };
  });
  const [copied, setCopied] = useState(false);
  const ui = useSyncExternalStore(subscribeUi, getUiState, getUiState);
  const pressed = (kind: 'plain' | 'note') => (ui.kind === kind && ui.burst !== 'idle' ? ' border-white/70 bg-white/15' : '');
  const update = (key: keyof BubbleTuning, v: string | number) => {
    setBubbleTuning({ [key]: v } as Partial<BubbleTuning>);
    setValues({ ...getBubbleTuning() });
  };
  const copy = async () => {
    const changed = Object.fromEntries(
      Object.entries(values).filter(([k, v]) => v !== DEFAULT_BUBBLE_TUNING[k as keyof BubbleTuning]),
    );
    const text = JSON.stringify(changed, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('复制失败，请手动复制', text);
    }
  };
  return (
    <div data-pond-ui="true" className="pointer-events-auto max-h-[78vh] w-60 overflow-y-auto rounded border border-white/10 bg-black/85 p-3 text-[11px] text-white/70 backdrop-blur-sm">
      <div className="mb-2 tracking-wide text-white/80">池塘气泡 · 手记（{GROUPS.reduce((n, g) => n + g.rows.length, 0)} 项）</div>
      <div className="mb-2 flex flex-wrap gap-1">
        <button type="button" className={BTN + pressed('plain')} onClick={() => requestBurst('plain')}>{burstLabel('立即冒一串', 'plain', ui)}</button>
        <button type="button" className={BTN + pressed('note')} onClick={() => requestBurst('note')}>{burstLabel('立即出手记', 'note', ui)}</button>
        <button type="button" className={BTN} onClick={copy}>{copied ? '已复制' : '复制改动 JSON'}</button>
        <button type="button" className={BTN}
          onClick={() => { resetBubbleTuning(); setValues({ ...DEFAULT_BUBBLE_TUNING }); }}>全部重置</button>
      </div>
      <div className="mb-2 border-b border-white/10 pb-2 text-[10px] text-white/50">
        冒泡：{BURST_TEXT[ui.burst]}　手记：{NOTE_TEXT[ui.note]}
      </div>
      {GROUPS.map((g) => (
        <details key={g.title} open={g.open} className="mb-1 border-t border-white/10 pt-1">
          <summary className="cursor-pointer py-1 text-white/80">{g.title}</summary>
          {g.rows.map((r) => <Field key={r.key} row={r} value={values[r.key]} onChange={(v) => update(r.key, v)} />)}
        </details>
      ))}
    </div>
  );
}
