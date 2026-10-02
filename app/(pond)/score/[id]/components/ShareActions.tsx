'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { isScoreAuthor, scoreShareCopy, scoreShareIntent, scoreShareUrl } from './experience/share-copy';

type Props = {
  id: string;
  tokenId: number | null;
  trackTitle: string;
  canonicalPath?: string;
  posterPath?: string | null;
  creatorAddress?: string | null;
};

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
  id, tokenId, trackTitle, canonicalPath, posterPath, creatorAddress,
}: Props) {
  const [feedback, setFeedback] = useState('复制链接');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const slug = tokenId ?? id;
  const auth = useAuth();
  const author = isScoreAuthor(auth.authenticated, auth.evmAddress, creatorAddress);
  const available = Boolean(canonicalPath);
  const getUrl = () => scoreShareUrl(process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin, canonicalPath);

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
    const url = getUrl();
    if (!url) { setFeedback('分享链接暂不可用'); return; }
    const target = scoreShareIntent(kind, scoreShareCopy(kind, trackTitle, author), url);
    const popup = window.open(target, '_blank', 'noopener,noreferrer');
    if (!popup) window.location.href = target;
  };

  const copy = async () => {
    const url = getUrl();
    setFeedback(url ? await copyText(url) ? '已复制' : '复制失败' : '分享链接暂不可用');
  };

  return (
    <div className="score-share-actions" data-pond-ui="true">
      <details ref={detailsRef}>
        <summary aria-label="展开分享方式">分享</summary>
        <div className="score-share-actions__menu">
          {!available && <p>分享链接暂不可用</p>}
          <button type="button" disabled={!available} onClick={copy}>{feedback}</button>
          <button type="button" disabled={!available} onClick={() => openIntent('x')}>分享到 X</button>
          <button type="button" disabled={!available} onClick={() => openIntent('weibo')}>分享到微博</button>
          {posterPath !== null && (
            <a href={posterPath ?? `/score/${slug}/poster`} download={`ripples-${slug}.png`}>下载海报</a>
          )}
        </div>
      </details>
    </div>
  );
}
