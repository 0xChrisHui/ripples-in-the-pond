'use client';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';

/** 手势只落在把手，正文保留原生滚动；同一收藏行不会因折叠而卸载。 */
export default function DrawerHandle({ expanded, setExpanded }: { expanded: boolean; setExpanded: (value: boolean) => void }) {
  const t = useTranslations('lens');
  const start = useRef<number | null>(null);
  const slid = useRef(false);
  return <button type="button" className="lens-drawer__handle" aria-expanded={expanded}
    aria-label={t(expanded ? 'collapse' : 'expand')} onClick={() => { if (!slid.current) setExpanded(!expanded); slid.current = false; }}
    onPointerDown={(event) => { start.current = event.clientY; slid.current = false; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerUp={(event) => {
      if (start.current !== null && Math.abs(event.clientY - start.current) > 12) {
        slid.current = true; setExpanded(event.clientY < start.current); event.preventDefault();
      }
      start.current = null;
    }} onPointerCancel={() => { start.current = null; }}><span aria-hidden="true" /></button>;
}
