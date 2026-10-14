'use client';

import { useEffect, useState } from 'react';
import type { ArtistContent } from '@/src/content/artist';
import type { Locale } from '../locale';

export type EnglishContent = { artist: ArtistContent; notes: Record<string, string> };

let pending: Promise<EnglishContent> | null = null;

/** 英文的艺术家内容与手记体积较大，只有选了英文才下载（与英文词典同一原则） */
function loadEnglishContent(): Promise<EnglishContent> {
  pending ??= Promise.all([import('./artist.en'), import('./artist-notes.en.json')])
    .then(([artist, notes]) => ({ artist: artist.artistContentEn, notes: notes.default as Record<string, string> }));
  return pending;
}

/** 英文模式返回英文内容；未加载完或中文模式返回 null，调用方回落中文原文 */
export function useEnglishContent(locale: Locale): EnglishContent | null {
  const [content, setContent] = useState<EnglishContent | null>(null);
  useEffect(() => {
    if (locale !== 'en') return;
    let cancelled = false;
    loadEnglishContent().then(
      (loaded) => { if (!cancelled) setContent(loaded); },
      (error: unknown) => { console.error('[i18n] 英文内容加载失败，保持中文', error); },
    );
    return () => { cancelled = true; };
  }, [locale]);
  return locale === 'en' ? content : null;
}
