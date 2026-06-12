'use client';
// Phase 8-F F5 cursorRing — 指尖涟漪环
// 空白水面上一圈低 opacity 椭圆环（ry = rx × 机位）以 lerp 延迟跟随鼠标；
// 悬停球上 / 拖拽中隐藏；移动端无意义（无 hover），由 effects-config 移动默认 false 保证。
import { useEffect, useRef } from 'react';
import { getPondTilt } from '../../hooks/pond/use-pond-tilt';

interface Props {
  svgRef: React.RefObject<SVGSVGElement | null>;
}

const RX = 18;       // 环半径
const LERP = 0.12;   // 延迟跟随系数

export default function CursorRing({ svgRef }: Props) {
  const ringRef = useRef<SVGEllipseElement>(null);
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const hiddenRef = useRef(true);   // 悬停球上 / 拖拽中 → 隐藏
  const draggingRef = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let raf = 0, cancelled = false;

    const onMove = (e: MouseEvent) => {
      const r = svg.getBoundingClientRect();
      targetRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      const t = e.target as Element | null;
      // 悬停在球上时隐藏（球节点带 data-sphere）
      hiddenRef.current = !!(draggingRef.current || t?.closest('[data-sphere]'));
    };
    const onLeave = () => { targetRef.current = null; };
    const onDown = () => { draggingRef.current = true; hiddenRef.current = true; };
    const onUp = () => { draggingRef.current = false; };

    svg.addEventListener('mousemove', onMove);
    svg.addEventListener('mouseleave', onLeave);
    svg.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);

    const tick = () => {
      if (cancelled) return;
      const ring = ringRef.current;
      const tgt = targetRef.current;
      if (ring) {
        if (!tgt || hiddenRef.current) {
          ring.style.opacity = '0';
        } else {
          posRef.current.x += (tgt.x - posRef.current.x) * LERP;
          posRef.current.y += (tgt.y - posRef.current.y) * LERP;
          const tilt = getPondTilt();
          ring.setAttribute('cx', String(posRef.current.x));
          ring.setAttribute('cy', String(posRef.current.y));
          ring.setAttribute('ry', String(RX * tilt));
          ring.style.opacity = '0.18';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      svg.removeEventListener('mousemove', onMove);
      svg.removeEventListener('mouseleave', onLeave);
      svg.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
    };
  }, [svgRef]);

  return (
    <ellipse
      ref={ringRef}
      rx={RX}
      ry={RX}
      fill="none"
      stroke="var(--pond-ripple)"
      strokeWidth={1}
      aria-hidden="true"
      style={{ opacity: 0, pointerEvents: 'none', transition: 'opacity 0.3s ease' }}
    />
  );
}
