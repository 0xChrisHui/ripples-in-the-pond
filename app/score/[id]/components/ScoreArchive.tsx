import EditionStamp, { type EditionStatus } from '@/src/components/p11/EditionStamp';
import ProvenanceLedger, { type ProvenanceEntry } from '@/src/components/p11/ProvenanceLedger';
import type { ScorePageData, ScoreProvenance } from '@/src/data/score-source';

const sourceLabels = {
  contract: 'OP 合约',
  database: '作品数据库',
  metadata: '永久 metadata',
  'metadata.animation_url': 'metadata.animation_url',
} as const;

const fields: Array<{ key: keyof ScoreProvenance; label: string; missing?: string }> = [
  { key: 'contract', label: 'ScoreNFT 合约' },
  { key: 'token', label: 'Token ID' },
  { key: 'creator', label: '创作者', missing: '永久来源未提供创作者地址' },
  { key: 'currentHolder', label: '当前持有者', missing: '暂时无法读取当前持有者' },
  { key: 'mintTransaction', label: '铸造交易', missing: '当前来源未记录铸造交易' },
  { key: 'setUriTransaction', label: '定稿交易', missing: '当前来源未记录定稿交易' },
  { key: 'tokenUri', label: '链上 Token URI' },
  { key: 'metadata', label: '永久 Metadata' },
  { key: 'events', label: '永久事件' },
  { key: 'base', label: '永久底曲' },
  { key: 'sounds', label: '永久音效表' },
  { key: 'decoder', label: '永久播放器' },
];

function ledgerEntries(provenance: ScoreProvenance): ProvenanceEntry[] {
  return fields.map(({ key, label, missing }) => {
    const item = provenance[key];
    return {
      id: key,
      label,
      value: item.value,
      source: sourceLabels[item.source],
      href: item.href ?? undefined,
      missingLabel: missing,
      copyable: key !== 'token',
    };
  });
}

function statusFor(score: ScorePageData): EditionStatus {
  if (score.state === 'processing') return 'processing';
  if (score.state === 'failed') return 'failed';
  return score.degraded ? 'degraded' : 'finalized';
}

function dateLabel(score: ScorePageData): string {
  const value = score.confirmedAt ?? score.createdAt ?? score.mintedAt;
  if (!value) return '时间未记录';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN');
}

export default function ScoreArchive({ score }: { score: ScorePageData }) {
  const token = score.tokenId == null ? '制作中' : `Token #${score.tokenId}`;
  return (
    <section className="score-archive" aria-labelledby="score-archive-title">
      <div className="score-archive__intro">
        <p className="score-archive__eyebrow">Permanent record · 永久档案</p>
        <h2 id="score-archive-title">作品凭证</h2>
        <p>
          播放输入逐字来自这枚作品钉住的永久资源。短值用于阅读，复制会保留完整哈希；
          创作者与当前持有者始终分开记录。
        </p>
        {score.provenance.decoder.href && (
          <a className="score-archive__decoder" href={score.provenance.decoder.href} target="_blank" rel="noopener noreferrer">
            在新标签打开永久播放器 <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
      <ProvenanceLedger entries={ledgerEntries(score.provenance)} />
      <div className="score-archive__edition">
        <EditionStamp status={statusFor(score)} detail={`${token} · ${dateLabel(score)}`} />
      </div>
    </section>
  );
}
