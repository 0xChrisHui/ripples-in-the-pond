'use client';
import { useEffect, useRef, useState } from 'react';
import type { OriginalTrack } from '../../lib/music-catalog/types';

type Props = { tracks: OriginalTrack[]; selectedId: string; onSelect: (trackId: string) => void;
  onPrepare?: (trackId: string) => void };

/** 数字方格共用一份曲目模型；目录滚动不会带动整页跳动。 */
export default function TrackIndex({ tracks, selectedId, onSelect, onPrepare }: Props) {
  const [open, setOpen] = useState(false);
  const current = useRef<HTMLButtonElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const item = current.current; const list = viewport.current;
    if (item && list) list.scrollTop = Math.max(0, item.offsetTop - list.offsetTop - list.clientHeight / 2 + item.clientHeight / 2);
  }, [selectedId, open]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const opener = trigger.current;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('.track-index__close')?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key !== 'Tab') return;
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      const first = buttons[0]; const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    const media = window.matchMedia('(min-width: 1100px)');
    const resized = () => { if (media.matches) setOpen(false); };
    media.addEventListener('change', resized);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keyboard);
      media.removeEventListener('change', resized);
      opener?.focus({ preventScroll: true });
    };
  }, [open]);
  function choose(id: string) { onSelect(id); setOpen(false); }
  return <nav className="track-index" aria-label={`${tracks.length} 首原曲目录`} data-track-index={tracks.length} data-open={open}>
    <button className="track-index__toggle" ref={trigger} type="button" aria-expanded={open}
      aria-controls="track-index-panel" onClick={() => setOpen(true)}><span>全部曲目</span><span>{tracks.length} <b aria-hidden="true">＋</b></span></button>
    <div className="track-index__panel" id="track-index-panel" ref={panel}
      role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label={open ? '选择一首原曲' : undefined}>
      <header className="track-index__heading"><span>曲目</span><span>01—{String(tracks.length).padStart(2, '0')}</span>
        <button className="track-index__close" type="button" onClick={() => setOpen(false)} aria-label="关闭曲目目录">×</button>
      </header>
      <div className="track-index__viewport" ref={viewport}>
        {tracks.map((track) => {
          const selected = track.trackId === selectedId;
          return <button key={track.trackId} ref={selected ? current : undefined} type="button"
            onClick={() => choose(track.trackId)} aria-pressed={selected} aria-current={selected}
            onPointerEnter={() => onPrepare?.(track.trackId)} onFocus={() => onPrepare?.(track.trackId)}
            aria-label={`切换到原曲 ${track.title}`} title={`原曲 ${track.title}`}
            data-track-index-item={track.displayNumber}>
            <span className="track-index__number">{String(track.displayNumber).padStart(2, '0')}</span>
          </button>;
        })}
      </div>
    </div>
  </nav>;
}
