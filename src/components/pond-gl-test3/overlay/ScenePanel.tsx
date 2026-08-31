'use client';

import { useState } from 'react';
import type { GLFlags } from '../gl-flags';

/**
 * /test3 视觉控制台（左下角）—— 从 /test1 的全量 25 开关裁成 7 项（task 3）。
 * 仅保留：背景图 / GL球 / 扭曲水面 / 月光焦散 / 可见塘底 / 月光倒影 / 自动降配。
 * 其余 flag（球浮沉/深度模型/透视视差/景深 等）在 /test3 作为**常驻行为**烘进默认值，不再上控制台。
 */
interface Props {
  glFlags: GLFlags;
  onGl: (patch: Partial<GLFlags>) => void;
}

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

export default function ScenePanel({ glFlags, onGl }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div data-pond-ui="true" className="pointer-events-auto fixed bottom-3 left-3 z-50 w-44 rounded border border-white/10 bg-black/85 p-3 text-[11px] text-white/70 backdrop-blur-sm">
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
          <Row label="背景图" checked={glFlags.bgImage} onChange={(v) => onGl({ bgImage: v })} />
          <Row label="图 1 调色" checked={glFlags.colorGrade} onChange={(v) => onGl({ colorGrade: v })} />
          <Row label="GL 球" checked={glFlags.glSpheres} onChange={(v) => onGl({ glSpheres: v })} />
          <Row label="圆圈数字" checked={glFlags.sphereLabels} onChange={(v) => onGl({ sphereLabels: v })} />
          <Row label="球浮动" checked={glFlags.sphereMotion} onChange={(v) => onGl({ sphereMotion: v })} />
          <Row label="球飘动+涟漪推" checked={glFlags.sphereDrift} onChange={(v) => onGl({ sphereDrift: v })} />
          <Row label="黑色圆圈（播放日蚀）" checked={glFlags.glEclipse} onChange={(v) => onGl({ glEclipse: v })} />
          <Row label="扭曲水面" checked={glFlags.waterFx} onChange={(v) => onGl({ waterFx: v })} />
          <Row label="月光焦散" checked={glFlags.caustics} onChange={(v) => onGl({ caustics: v })} />
          <Row label="可见塘底" checked={glFlags.pondFloor} onChange={(v) => onGl({ pondFloor: v })} />
          <Row label="月光倒影" checked={glFlags.moonReflect} onChange={(v) => onGl({ moonReflect: v })} />
          <Row label="水面花瓣" checked={glFlags.flowerPetals} onChange={(v) => onGl({ flowerPetals: v })} />
          <Row label="漂浮微光" checked={glFlags.floatMotes} onChange={(v) => onGl({ floatMotes: v })} />
          <div className="mb-1 mt-2 text-[10px] uppercase tracking-wider text-white/30">相机</div>
          <Row label="焦平面景深" checked={glFlags.dof} onChange={(v) => onGl({ dof: v })} />
          <Row label="一点透视" checked={glFlags.perspective} onChange={(v) => onGl({ perspective: v })} />
          <Row label="鼠标视差" checked={glFlags.parallax} onChange={(v) => onGl({ parallax: v })} />
          <div className="mb-1 mt-2 text-[10px] uppercase tracking-wider text-white/30">性能</div>
          <Row label="自动降配" checked={glFlags.autoDegrade} onChange={(v) => onGl({ autoDegrade: v })} />
          <div className="mb-1 mt-2 text-[10px] uppercase tracking-wider text-white/30">生命感</div>
          <Row label="滚轮去同步" checked={glFlags.wheelDesync} onChange={(v) => onGl({ wheelDesync: v })} />
          <Row label="视差去同步" checked={glFlags.parallaxDesync} onChange={(v) => onGl({ parallaxDesync: v })} />
          <Row label="流场游移" checked={glFlags.flowDrift} onChange={(v) => onGl({ flowDrift: v })} />
          <Row label="偶发颤动" checked={glFlags.shiver} onChange={(v) => onGl({ shiver: v })} />
          {/* 激励是边缘波幅的乘性放大（shader: uEdgeAmp×(1+激励)），单开无效果 → 双向联动防死开关 */}
          <Row label="能量球边缘" checked={glFlags.edgeWave} onChange={(v) => onGl(v ? { edgeWave: true } : { edgeWave: false, edgeExcite: false })} />
          <Row label="扰动激励(联动边缘)" checked={glFlags.edgeExcite} onChange={(v) => onGl(v ? { edgeExcite: true, edgeWave: true } : { edgeExcite: false })} />
          <Row label="果冻感" checked={glFlags.jelly} onChange={(v) => onGl({ jelly: v })} />
          <Row label="鼠标水波扰球" checked={glFlags.wakeSpheres} onChange={(v) => onGl({ wakeSpheres: v })} />
          <Row label="时隐时现" checked={glFlags.alphaFlicker} onChange={(v) => onGl({ alphaFlicker: v })} />
          <Row label="光晕呼吸" checked={glFlags.haloBreath} onChange={(v) => onGl({ haloBreath: v })} />
        </>
      )}
    </div>
  );
}
