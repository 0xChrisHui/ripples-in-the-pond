'use client';

import { GROUPS, getGroupTargetCount } from '@/src/components/archipelago/sphere-config';
import type { GlSim } from '../spheres/use-gl-sim';

/**
 * I1 — GL 切组 nav（左上 A/B/C）。取代被卸载的 Archipelago SVG nav。
 * 点击直接切 GL 组（glSim.setGroup → 重建 sim），修掉 G4「nav 点击 GL 不跟随」的历史限制；
 * 顺手发一道 bg-ripple:wave（复用涟漪桥 → 水面起波 + 推球），与键盘 ←→ 并行。
 */
export default function GlNav({ glSim }: { glSim: GlSim }) {
  const pick = (id: (typeof GROUPS)[number]['id'], el: HTMLElement) => {
    if (id === glSim.groupId) return;
    const r = el.getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent('bg-ripple:wave', { detail: { x: r.left, y: r.top + r.height / 2, size: 520, duration: 18 } }),
    );
    glSim.setGroup(id);
  };

  return (
    <nav className="pointer-events-auto fixed left-6 top-24 z-30 flex flex-col items-start gap-2">
      {GROUPS.map((g) => {
        const active = g.id === glSim.groupId;
        return (
          <button
            key={g.id}
            type="button"
            onClick={(e) => pick(g.id, e.currentTarget)}
            className={[
              'flex items-center gap-2 rounded px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition',
              active
                ? 'border border-white/10 bg-white/5 text-white/80'
                : 'border border-transparent text-white/30 hover:text-white/60',
            ].join(' ')}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: g.color }} />
            {g.label}
            <span className="text-[8.5px] text-white/30">{getGroupTargetCount(g.id)}</span>
          </button>
        );
      })}
    </nav>
  );
}
