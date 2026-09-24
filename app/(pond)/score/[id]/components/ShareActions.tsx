'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  id: string;
  tokenId: number | null;
  trackTitle: string;
  canonicalPath?: string;
  posterPath?: string | null;
};

function canonicalUrl(id: string, tokenId: number | null, canonicalPath?: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
  return `${base.replace(/\/$/, '')}${canonicalPath ?? `/score/${tokenId ?? id}`}`;
}

function shareText(trackTitle: string, tokenId: number | null): string {
  return `在“${trackTitle}”上的即兴演奏${tokenId == null ? '' : ` · Ripples #${tokenId}`}`;
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* 使用旧浏览器兼容路径。 */ }
  const field = document.createElement('textarea');
  field.value = value;
  field.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(field);
  field.select();
  try { return document.execCommand('copy'); } catch { return false; } finally { field.remove(); }
}

/** 首屏分享入口直接展开站内渠道，不触发操作系统的原生分享面板。 */
export default function ShareActions({
  id, tokenId, trackTitle, canonicalPath, posterPath,
}: Props) {
  const [feedback, setFeedback] = useState('复制链接');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const slug = tokenId ?? id;

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  const openIntent = (kind: 'x' | 'weibo') => {
    const url = canonicalUrl(id, tokenId, canonicalPath);
    const text = shareText(trackTitle, tokenId);
    const target = kind === 'x'
      ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
      : `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
    const popup = window.open(target, '_blank', 'noopener,noreferrer');
    if (!popup) window.location.href = target;
  };

  const copy = async () => {
    setFeedback(await copyText(canonicalUrl(id, tokenId, canonicalPath)) ? '已复制' : '复制失败');
  };

  return (
    <div className="score-share-actions" data-pond-ui="true">
      <details ref={detailsRef}>
        <summary aria-label="展开分享方式">分享</summary>
        <div className="score-share-actions__menu">
          <button type="button" onClick={copy}>{feedback}</button>
          <button type="button" onClick={() => openIntent('x')}>分享到 X</button>
          <button type="button" onClick={() => openIntent('weibo')}>分享到微博</button>
          {posterPath !== null && (
            <a href={posterPath ?? `/score/${slug}/poster`} download={`ripples-${slug}.png`}>下载海报</a>
          )}
        </div>
      </details>
    </div>
  );
}
