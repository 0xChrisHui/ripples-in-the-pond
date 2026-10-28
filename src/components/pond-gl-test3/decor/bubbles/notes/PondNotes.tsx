'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getCarrier, isSuppressed, registerNoteHost, releaseCarrier, subscribeBridge } from '../bubble-bridge';
import { defaultNoteSources } from './default-sources';
import { loadSnippetPool, pickSnippet } from './snippet-pool';
import type { NoteLang } from './snippet-split';
import { FADE_MS } from './note-display';
import { usePondNoteTimeline } from './usePondNoteTimeline';

/**
 * P20 创作手记宿主（Canvas 外的 HTML）。载体泡停在水面时，在泡旁逐行淡入一段手记（裸字，无框）；
 * 悬停 / 点按才出现半透明框（复用 /me 控件材质）；字先淡出、泡后破。
 * 只有文字块接收指针；整层 pointer-events:none，不挡球的点击。
 */
const poolCache = new Map<NoteLang, Promise<string[]>>();
function poolFor(lang: NoteLang): Promise<string[]> {
  let p = poolCache.get(lang);
  if (!p) {
    p = loadSnippetPool(lang, defaultNoteSources).then((pool) => {
      if (pool.length === 0) poolCache.delete(lang); // 加载失败不缓存空池，下次还能重试
      return pool;
    });
    poolCache.set(lang, p);
  }
  return p;
}

interface Active { id: number; lang: NoteLang; text: string }

const TEXT_W = 360, GAP = 18, EDGE = 8, TOP_SAFE = 150, BOTTOM_SAFE = 120;
const BOX_STYLE = { background: 'rgb(1 7 6 / 72%)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid color-mix(in srgb, var(--p11-bone, #e8e4da) 12%, transparent)', borderRadius: 6 } as const;

function NoteView({ note, u, v, onDone }: { note: Active; u: number; v: number; onDone: () => void }) {
  const t = useTranslations('home');
  const [hover, setHover] = useState(false);
  const [held, setHeld] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { lines, shown, phase, dismiss } = usePondNoteTimeline(note.text, note.lang, hover || held, onDone);

  useEffect(() => { // 手机：点空白消失（电脑端靠停留超时 / 播放 / 切语言撤下）
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) dismiss(); };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [dismiss]);

  const vw = window.innerWidth, vh = window.innerHeight;
  const x = u * vw;
  const y = Math.min(Math.max(v * vh, TOP_SAFE), vh - BOTTOM_SAFE);
  const right = x < vw * 0.58 && vw - x - GAP - EDGE >= 160; // 泡偏左 → 字在右；空间不够就翻到左边
  const width = Math.min(TEXT_W, right ? vw - x - GAP - EDGE : x - GAP - EDGE);
  const out = phase === 'out';
  const fade = `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`;
  return (
    <div className="pointer-events-none fixed inset-0 z-10" aria-hidden={false}>
      <div ref={ref} role="note" aria-label={t('noteLabel')}
        className="pointer-events-auto absolute"
        style={{ top: y, transform: 'translateY(-50%)', width, minHeight: 44, [right ? 'left' : 'right']: right ? x + GAP : vw - x + GAP,
          textAlign: right ? 'left' : 'right', padding: '10px 14px', touchAction: 'manipulation' }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(false); }}
        onPointerUp={(e) => { if (e.pointerType !== 'mouse') setHeld((h) => !h); }}>
        <div className="absolute inset-0" style={{ ...BOX_STYLE, opacity: !out && (hover || held) ? 1 : 0, transition: `opacity 300ms ease` }} />
        <p className="relative m-0" style={{ fontFamily: 'var(--p11-font-display, serif)', fontSize: 15, lineHeight: 1.75,
          color: 'rgb(233 241 247 / 78%)', textShadow: '0 1px 8px rgb(0 0 0 / 55%)' }}>
          {lines.map((line, i) => (
            <span key={i} className="block" style={{ opacity: i < shown && !out ? 1 : 0,
              transform: out ? 'translateY(-2px)' : i < shown ? 'translateY(0)' : 'translateY(5px)', transition: fade }}>{line}</span>
          ))}
        </p>
      </div>
    </div>
  );
}

export default function PondNotes() {
  const locale: NoteLang = useLocale() === 'en' ? 'en' : 'zh';
  const carrier = useSyncExternalStore(subscribeBridge, getCarrier, () => null);
  const suppressed = useSyncExternalStore(subscribeBridge, isSuppressed, () => false);
  const [active, setActive] = useState<Active | null>(null);
  const lastIndex = useRef<Record<NoteLang, number | null>>({ zh: null, en: null });

  useEffect(() => registerNoteHost(), []);
  useEffect(() => { releaseCarrier(); }, [locale]);           // 切语言：撤下当前手记，下一条用新语言
  useEffect(() => { if (suppressed) releaseCarrier(); }, [suppressed]);

  const carrierId = carrier?.id ?? 0;
  useEffect(() => {
    if (!carrierId) return;
    let cancelled = false;
    void poolFor(locale).then((pool) => {
      if (cancelled) return;
      const pick = pickSnippet(pool, Math.random, lastIndex.current[locale]);
      if (!pick) { releaseCarrier(); return; }               // 池空（如英文加载失败）：不回退中文，泡照常破
      lastIndex.current[locale] = pick.index;
      setActive({ id: carrierId, lang: locale, text: pick.text });
    });
    return () => { cancelled = true; };
  }, [carrierId, locale]);

  const done = useCallback(() => releaseCarrier(), []);
  if (!carrier || suppressed || !active || active.id !== carrier.id || active.lang !== locale) return null;
  return <NoteView key={active.id} note={active} u={carrier.u} v={carrier.v} onDone={done} />;
}
