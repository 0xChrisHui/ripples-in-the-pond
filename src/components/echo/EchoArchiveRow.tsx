import Link from 'next/link';
import type { EchoArchiveItem } from '@/src/data/echo/types';

const STATUS: Record<EchoArchiveItem['status'], string> = {
  owned: '当前持有', excluded_prelaunch: '启用前作品', pending: '等待制作',
  preparing_media: '核验永久媒体', uploading_metadata: '写入永久档案',
  minting_onchain: '链上铸造中', confirming_onchain: '等待链上确认',
  safe_retry: '安全重试中', manual_review: '等待人工核验', success: '已转出',
};

export default function EchoArchiveRow({ echo, index }: { echo: EchoArchiveItem; index: number }) {
  const href = echo.tokenId ? `/echo/${echo.tokenId}` : `/echo/origin/${echo.originWallet}`;
  const detail = echo.relation === 'current-owner'
    ? '链上 ownerOf 确认当前属于你'
    : echo.status === 'success' ? '由你的钱包诞生，目前由另一地址持有'
      : echo.status === 'excluded_prelaunch' ? '这枚 Score 早于启用边界，不参与自动生成'
        : '由你的首枚 Score 触发，尚未成为可转让作品';
  return (
    <article className="me-archive-row" data-status={echo.status === 'owned' ? 'finalized' : echo.status}>
      <p className="me-archive-row__index">{String(index + 1).padStart(2, '0')} · ECHO</p>
      <div className="me-archive-row__main"><h3>{echo.name}</h3><p>{detail}</p></div>
      <div className="me-archive-row__state"><span>{STATUS[echo.status]}</span>{echo.hasError && <small>已失败关闭，详情保留在运维记录</small>}</div>
      <Link className="me-archive-row__action" href={href}>
        {echo.tokenId ? '打开作品' : '查看状态'} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
