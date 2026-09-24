'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { OwnedScoreNFT, ScoreMintStatus } from '@/src/types/jam';
import { usePondTransition } from '@/src/components/pond-shell/pond-transition';
import { useScoreOrigin, viewTransitionName } from '@/src/components/pond-shell/score/score-origin';

const STATUS_LABELS: Record<ScoreMintStatus, string> = {
  pending: '等待制作',
  uploading_events: '保存演奏中',
  preparing_package: '核验永久资源',
  minting_onchain: '写入链上',
  uploading_metadata: '装配唱片',
  setting_uri: '绑定永久播放器',
  finalizing_snapshot: '生成验证快照',
  success: '永久唱片',
  failed: '制作未完成',
};

function failureDetail(score: OwnedScoreNFT): string | null {
  if (score.status !== 'failed') return null;
  if (score.failureKind === 'safe_retry') return '制作已停止，可从详情核验';
  return '需要核验后再处理';
}

type Props = { score: OwnedScoreNFT; index: number; ownerKey: string };

/** 只有稳定 Token 行增强为锚点；其余状态始终保留普通链接语义。 */
export default function ScoreArchiveRow({ score, index, ownerKey }: Props) {
  const rowRef = useRef<HTMLElement>(null);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const transition = usePondTransition();
  const scoreOrigin = useScoreOrigin();
  const isPermanent = score.status === 'success' && score.tokenId != null;
  const key = `score-${score.queueId}`;
  const href = `/score/${score.id}`;
  const selected = isPermanent && scoreOrigin.origin?.key === key;
  const transaction = transition?.transaction;
  const ownsAnchor = selected && (transaction?.target === 'score'
    && transaction.stage === 'preparing'
    || scoreOrigin.origin?.stage === 'returning' && transaction?.target === 'archive'
      && transaction.stage !== 'preparing');
  const title = isPermanent ? `Ripples #${score.tokenId}` : score.trackTitle;
  const detail = failureDetail(score);
  const action = isPermanent ? '打开唱片' : score.status === 'failed' ? '查看详情' : '查看进度';

  const openScore = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey || event.currentTarget.target === '_blank') return;
    event.preventDefault();
    if (pendingRef.current) return;
    if (!transition) return;
    const row = rowRef.current;
    const rect = row?.getBoundingClientRect();
    pendingRef.current = true;
    setPending(true);
    if (isPermanent && row && rect && score.tokenId != null) {
      const section = row.closest<HTMLElement>('[data-archive-section]');
      scoreOrigin.capture({
        key, href, tokenId: score.tokenId, ownerKey,
        section: section?.dataset.archiveSection ?? 'records',
        page: Number(section?.dataset.archivePage ?? 0), scrollY: window.scrollY,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });
    } else scoreOrigin.clear();
    transition.navigate(href);
  };

  useEffect(() => {
    if (!pendingRef.current || !transaction) return;
    const stillOpening = transaction.target === 'score' && transaction.href === href;
    if (stillOpening) return;
    pendingRef.current = false;
    queueMicrotask(() => setPending(false));
  }, [href, transaction]);

  useEffect(() => {
    const origin = scoreOrigin.origin;
    if (origin?.stage === 'forward' && transaction?.stage === 'stable'
      && transaction.current === 'archive') scoreOrigin.clear(origin.id);
  }, [scoreOrigin, transaction]);

  return (
    <article ref={rowRef} className="me-archive-row" data-status={score.status}
      data-score-origin-key={key} data-score-origin-selected={selected || undefined}
      aria-busy={pending || undefined}
      style={ownsAnchor ? { viewTransitionName: viewTransitionName() } as CSSProperties : undefined}>
      <p className="me-archive-row__index">{String(index + 1).padStart(2, '0')}</p>
      <div className="me-archive-row__main">
        <h3>{title}</h3>
        {isPermanent && <p>{score.trackTitle}</p>}
      </div>
      <div className="me-archive-row__state">
        <span>{STATUS_LABELS[score.status]}</span>
        {detail && <small>{detail}</small>}
      </div>
      <Link className="me-archive-row__action" href={href} onClick={openScore}
        onMouseEnter={() => transition?.prefetch(href)} onFocus={() => transition?.prefetch(href)}
        onTouchStart={() => transition?.prefetch(href)}
        aria-disabled={pending || undefined}>
        {action} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
