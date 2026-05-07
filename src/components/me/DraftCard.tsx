'use client';

import { useMintScore } from '@/src/hooks/useMintScore';

/**
 * DraftCard — 草稿卡片（B8 简化）
 *
 * 4 态显示：
 *   - !pendingScoreId         →「上传中...」（本地草稿等待自动 POST）
 *   - clientState='queued'    →「铸造中...」（点击后 0-5s 乐观瞬态）
 *   - clientState='success'   →「铸造成功 ✓」（5s 后强制转，刷新 /me 后草稿消失，去"我的唱片"）
 *   - 默认                     →「铸造成唱片 NFT」按钮
 *
 * 不再显示：已过期 / 服务端铸造态 / 失败提示
 *   - 过期：服务端 GET 已过滤，本地草稿 buildDisplayDrafts 也过滤
 *   - 失败：邮件告警 + 后台兜底，前端不感知
 */
export default function DraftCard({
  title,
  pendingScoreId,
}: {
  title: string;
  pendingScoreId?: string;
}) {
  const { state: clientState, mint } = useMintScore();

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/70">{title}</p>

      <div className="mt-3 flex justify-end">
        {!pendingScoreId ? (
          <span className="rounded-full border border-white/10 px-4 py-1 text-xs text-white/30">
            上传中...
          </span>
        ) : clientState === 'queued' ? (
          <span className="text-xs text-white/80">铸造中...</span>
        ) : clientState === 'success' ? (
          <span className="text-xs text-emerald-400/90">铸造成功 ✓</span>
        ) : (
          <button
            type="button"
            onClick={() => mint(pendingScoreId)}
            className="rounded-full border border-white/40 px-4 py-1 text-xs text-white/90 transition-all hover:bg-white/10"
          >
            铸造成唱片 NFT
          </button>
        )}
      </div>
    </div>
  );
}
