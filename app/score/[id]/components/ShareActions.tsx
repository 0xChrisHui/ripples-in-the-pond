'use client';

import { useState } from 'react';

type Props = { id: string; tokenId: number | null; trackTitle: string };

function canonicalUrl(id: string, tokenId: number | null): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
  return `${base.replace(/\/$/, '')}/score/${tokenId ?? id}`;
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

/** 首屏保留一个明确分享主动作，完整渠道紧邻展开，不再埋到账本之后。 */
export default function ShareActions({ id, tokenId, trackTitle }: Props) {
  const [feedback, setFeedback] = useState('复制链接');
  const slug = tokenId ?? id;

  const openIntent = (kind: 'x' | 'weibo') => {
    const url = canonicalUrl(id, tokenId);
    const text = shareText(trackTitle, tokenId);
    const target = kind === 'x'
      ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
      : `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
    const popup = window.open(target, '_blank', 'noopener,noreferrer');
    if (!popup) window.location.href = target;
  };

  const share = async () => {
    const url = canonicalUrl(id, tokenId);
    try {
      if (navigator.share) {
        await navigator.share({ title: `Ripples #${tokenId ?? ''}`.trim(), text: shareText(trackTitle, tokenId), url });
        setFeedback('已分享');
      } else {
        setFeedback(await copyText(url) ? '已复制' : '复制失败');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFeedback('重试分享');
    }
  };

  const copy = async () => {
    setFeedback(await copyText(canonicalUrl(id, tokenId)) ? '已复制' : '复制失败');
  };

  return (
    <div className="score-share-actions" data-pond-ui="true">
      <button className="score-share-actions__primary" type="button" onClick={share}>分享</button>
      <details>
        <summary aria-label="展开其他分享方式">更多</summary>
        <div className="score-share-actions__menu">
          <button type="button" onClick={copy}>{feedback}</button>
          <button type="button" onClick={() => openIntent('x')}>分享到 X</button>
          <button type="button" onClick={() => openIntent('weibo')}>分享到微博</button>
          <a href={`/score/${slug}/poster`} download={`ripples-${slug}.png`}>下载海报</a>
        </div>
      </details>
    </div>
  );
}
