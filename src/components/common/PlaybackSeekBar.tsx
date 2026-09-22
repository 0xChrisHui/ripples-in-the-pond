'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import './playback-seek-bar.css';

type Props = {
  className?: string;
  value: number;
  duration: number;
  onSeek: (position: number) => void;
  formatValue: (position: number) => string;
  disabled?: boolean;
  label?: string;
};

function clamp(value: number, duration: number): number {
  return Math.min(duration, Math.max(0, value));
}

/** 采用指针捕获：拖动始终跟手，松开后再一次性重排音频时间轴。 */
export default function PlaybackSeekBar({
  className = '', value, duration, onSeek, formatValue,
  disabled = false, label = '播放进度',
}: Props) {
  const railRef = useRef<HTMLSpanElement>(null);
  const draggingRef = useRef(false);
  const draftRef = useRef(value);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(value);
  const safeDuration = Math.max(0, duration);
  const unavailable = disabled || safeDuration <= 0;
  const displayValue = clamp(dragging ? draft : value, safeDuration);
  const progress = safeDuration > 0 ? displayValue / safeDuration : 0;

  const preview = (position: number) => {
    const next = clamp(position, safeDuration);
    draftRef.current = next;
    setDraft(next);
    return next;
  };

  const valueFromPointer = (clientX: number) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect?.width) return displayValue;
    return clamp(((clientX - rect.left) / rect.width) * safeDuration, safeDuration);
  };

  const commit = (position: number) => {
    const next = preview(position);
    draggingRef.current = false;
    setDragging(false);
    if (!unavailable) onSeek(next);
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (unavailable || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setDragging(true);
    preview(valueFromPointer(event.clientX));
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    preview(valueFromPointer(event.clientX));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const next = preview(valueFromPointer(event.clientX));
    commit(next);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const cancelDrag = () => {
    draggingRef.current = false;
    setDragging(false);
    preview(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (unavailable) return;
    const step = Math.max(1_000, safeDuration / 100) * (event.shiftKey ? 10 : 1);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? safeDuration
        : ['ArrowRight', 'ArrowUp', 'PageUp'].includes(event.key) ? displayValue + step
          : ['ArrowLeft', 'ArrowDown', 'PageDown'].includes(event.key) ? displayValue - step
            : null;
    if (next === null) return;
    event.preventDefault();
    commit(next);
  };

  return (
    <div className={`playback-seek ${className}`} role="slider" tabIndex={unavailable ? -1 : 0}
      aria-label={label} aria-orientation="horizontal" aria-disabled={unavailable}
      aria-valuemin={0} aria-valuemax={Math.round(safeDuration)} aria-valuenow={Math.round(displayValue)}
      aria-valuetext={`${formatValue(displayValue)} / ${formatValue(safeDuration)}`}
      data-dragging={dragging} data-disabled={unavailable}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={() => { if (draggingRef.current) commit(draftRef.current); }}
      onKeyDown={handleKeyDown}>
      <span ref={railRef} className="playback-seek__rail" aria-hidden="true">
        <span className="playback-seek__fill" style={{ transform: `scaleX(${progress})` }} />
        <span className="playback-seek__thumb" style={{ left: `${progress * 100}%` }} />
      </span>
    </div>
  );
}
