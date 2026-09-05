import Link from 'next/link';
import type { OwnedScoreNFT, ScoreMintStatus } from '@/src/types/jam';

const STATUS_LABELS: Record<ScoreMintStatus, string> = {
  pending: '等待制作',
  uploading_events: '保存演奏中',
  minting_onchain: '写入链上',
  uploading_metadata: '装配唱片',
  setting_uri: '绑定永久播放器',
  success: '永久唱片',
  failed: '制作未完成',
};

function failureDetail(score: OwnedScoreNFT): string | null {
  if (score.status !== 'failed') return null;
  if (score.failureKind === 'safe_retry') return '制作已停止，可从详情核验';
  return '需要核验后再处理';
}

/** Score 队列状态逐字映射；失败态只进入详情，不制造不存在的恢复动作。 */
export default function ScoreArchiveRow({ score, index }: { score: OwnedScoreNFT; index: number }) {
  const isPermanent = score.status === 'success' && score.tokenId != null;
  const title = isPermanent ? `Ripples #${score.tokenId}` : score.trackTitle;
  const detail = failureDetail(score);
  const action = isPermanent ? '打开唱片' : score.status === 'failed' ? '查看详情' : '查看进度';

  return (
    <article className="me-archive-row" data-status={score.status}>
      <p className="me-archive-row__index">{String(index + 1).padStart(2, '0')} · RECORD</p>
      <div className="me-archive-row__main">
        <h3>{title}</h3>
        <p>{score.trackTitle}{score.eventCount == null ? ' · 事件数待核验' : ` · ${score.eventCount} 个永久事件`}</p>
        <time dateTime={score.submittedAt}>
          提交于 {new Date(score.submittedAt).toLocaleDateString('zh-CN')}
        </time>
      </div>
      <div className="me-archive-row__state">
        <span>{STATUS_LABELS[score.status]}</span>
        {detail && <small>{detail}</small>}
      </div>
      <Link className="me-archive-row__action" href={`/score/${score.id}`}>
        {action} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
