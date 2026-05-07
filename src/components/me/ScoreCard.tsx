import Link from 'next/link';
import type { OwnedScoreNFT } from '@/src/types/jam';

/**
 * ScoreCard — 个人页"我的唱片"卡片
 *
 * 已上链（tokenId 存在）：Link 到 /score/[tokenId]，显示 "Ripples #{tokenId}"
 * 未上链（tokenId undefined）：div 不可点击，显示 "Ripples · 上链中"
 *   后台 cron 跑完后自动转上链态（用户下次刷新看到 #{tokenId}）。
 *   失败由邮件告警 + 运营兜底重铸，前端不感知。
 */
export default function ScoreCard({ score }: { score: OwnedScoreNFT }) {
  const isOnchain = score.tokenId != null;

  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={score.coverUrl}
        alt={isOnchain ? `Ripples #${score.tokenId}` : '上链中的唱片'}
        width={64}
        height={64}
        className="h-16 w-16 rounded-lg object-cover"
      />

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-sm font-medium text-white/90">
          {isOnchain ? `Ripples #${score.tokenId}` : 'Ripples · 上链中'}
        </p>
        <p className="mt-0.5 truncate text-xs text-white/50">
          {score.trackTitle} · {score.eventCount} 音符
        </p>
        <p className="mt-0.5 text-xs text-white/30">
          {new Date(score.mintedAt).toLocaleDateString()}
        </p>
      </div>

      {isOnchain && (
        <span className="self-center text-white/20 transition group-hover:text-white/50">
          →
        </span>
      )}
    </>
  );

  if (isOnchain) {
    return (
      <Link
        href={`/score/${score.id}`}
        className="group flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 opacity-70">
      {inner}
    </div>
  );
}
