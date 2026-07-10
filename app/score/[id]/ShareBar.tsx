'use client';

import { useState } from 'react';

/**
 * /score/[id] 分享按钮组（P10-A A1）：Twitter/X、微博、复制链接。
 * 全部零依赖、零新 API：X/微博走 intent URL 弹窗，复制走 clipboard + 降级。
 * 视觉对齐现页 font-mono text-xs text-white/30 底色系，不做新设计（P11 再统一）。
 */

type Props = { id: string; tokenId: number | null; trackTitle: string };

/** canonical：已上链优先用数字 tokenId 路由（更短、永久有效），否则用 UUID */
function shareUrl(id: string, tokenId: number | null): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  const slug = tokenId != null ? String(tokenId) : id;
  return `${base}/score/${slug}`;
}

function shareText(trackTitle: string, tokenId: number | null): string {
  const suffix = tokenId != null ? ` · Ripples #${tokenId}` : '';
  return `在 "${trackTitle}" 上的即兴演奏${suffix}`;
}

/** clipboard 主路径 → execCommand 降级 → 都不行返回 false（调用方显示手动复制） */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 落到降级 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function ShareBar({ id, tokenId, trackTitle }: Props) {
  const [copyLabel, setCopyLabel] = useState('复制链接');

  const openShare = (build: (url: string, text: string) => string) => {
    const url = shareUrl(id, tokenId);
    const text = shareText(trackTitle, tokenId);
    const target = build(url, text);
    // 弹窗被拦截 → window.open 返回 null，降级当前页跳转
    const win = window.open(target, '_blank', 'noopener,noreferrer');
    if (!win) window.location.href = target;
  };

  const onTwitter = () =>
    openShare(
      (url, text) =>
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    );

  const onWeibo = () =>
    openShare(
      (url, text) =>
        `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
    );

  const onCopy = async () => {
    const url = shareUrl(id, tokenId);
    const ok = await copyToClipboard(url);
    setCopyLabel(ok ? '已复制 ✓' : url);
    if (ok) window.setTimeout(() => setCopyLabel('复制链接'), 2000);
  };

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-xs text-white/30">
      <button onClick={onTwitter} className="transition-colors hover:text-white/70">
        分享到 X
      </button>
      <button onClick={onWeibo} className="transition-colors hover:text-white/70">
        分享到微博
      </button>
      <button
        onClick={onCopy}
        className="max-w-full truncate transition-colors hover:text-white/70"
        title="复制分享链接"
      >
        {copyLabel}
      </button>
    </div>
  );
}
