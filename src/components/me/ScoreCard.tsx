'use client';

import Link from 'next/link';
import type { OwnedScoreNFT } from '@/src/types/jam';

/**
 * ScoreCard — 个人页"我的唱片"卡片
 *
 * 路由统一 /score/[id]（B8 双兼容：数字按 tokenId / UUID 按 queue.id）。
 * 已上链：标题"Ripples #{tokenId}"；未上链："Ripples · 上链中"，外观淡显 + 已等待时长。
 * 两种态都可点击进详情页，详情页内的播放方案完全相同（前端 inline）。
 */
export default function ScoreCard({ score }: { score: OwnedScoreNFT }) {
  const isOnchain = score.tokenId != null;
  const title = isOnchain ? `Ripples #${score.tokenId}` : 'Ripples · 上链中';

  // 用提交绝对时间避免 Date.now()（impure function lint 规则）
  const queuedAt = isOnchain
    ? null
    : new Date(score.mintedAt).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });

  return (
    <Link
      href={`/score/${score.id}`}
      className={[
        'group flex gap-4 rounded-xl border border-white/10 p-4 transition-colors',
        isOnchain ? 'bg-white/5 hover:bg-white/10' : 'bg-white/[0.03] opacity-70 hover:opacity-90',
      ].join(' ')}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={score.coverUrl}
        alt={title}
        width={64}
        height={64}
        className="h-16 w-16 rounded-lg object-cover"
      />

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-sm font-medium text-white/90">{title}</p>
        <p className="mt-0.5 truncate text-xs text-white/50">
          {score.trackTitle} · {score.eventCount} 音符
        </p>
        <p className="mt-0.5 text-xs text-white/30">
          {isOnchain
            ? new Date(score.mintedAt).toLocaleDateString()
            : `${queuedAt} 提交（通常 5-30 分钟）`}
        </p>
      </div>

      <span className="self-center text-white/20 transition group-hover:text-white/50">
        →
      </span>
    </Link>
  );
}
