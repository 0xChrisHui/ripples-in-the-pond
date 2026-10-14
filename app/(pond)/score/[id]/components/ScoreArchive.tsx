import EditionStamp, { type EditionStatus } from '@/src/components/p11/EditionStamp';
import ProvenanceLedger, { type ProvenanceEntry } from '@/src/components/p11/ProvenanceLedger';
import type { ScorePageData, ScoreProvenance } from '@/src/data/score-source';
import type { ScoreHolderState } from './use-score-holder';
import { useTranslations } from 'next-intl';

type Translate = ReturnType<typeof useTranslations<'score.archive'>>;
// 来源与字段标签在词典 score.archive.*；metadata.animation_url、Token ID 是技术写法，中英相同，保留字面量
const sourceKeys = { contract: 'contract', database: 'database', metadata: 'metadata' } as const;
function sourceLabel(t: Translate, source: ScoreProvenance[keyof ScoreProvenance]['source']): string {
  return source === 'metadata.animation_url' ? source : t(`sources.${sourceKeys[source]}`);
}

const fields: Array<{ key: keyof ScoreProvenance; missing?: boolean }> = [
  { key: 'contract' },
  { key: 'token' },
  { key: 'creator', missing: true },
  { key: 'currentHolder', missing: true },
  { key: 'mintTransaction', missing: true },
  { key: 'setUriTransaction', missing: true },
  { key: 'tokenUri' },
  { key: 'metadata' },
  { key: 'events' },
  { key: 'base' },
  { key: 'sounds' },
  { key: 'decoder' },
];
type MissingKey = 'creator' | 'currentHolder' | 'mintTransaction' | 'setUriTransaction';

function ledgerEntries(t: Translate, provenance: ScoreProvenance, holder?: ScoreHolderState): ProvenanceEntry[] {
  return fields.map(({ key, missing: hasMissing }) => {
    const label = key === 'token' ? 'Token ID' : t(`fields.${key as Exclude<keyof ScoreProvenance, 'token'>}`);
    const missing = hasMissing ? t(`missing.${key as MissingKey}`) : undefined;
    if (key === 'currentHolder' && holder) {
      return {
        id: key, label, value: holder.value, source: sourceLabel(t, 'contract'),
        href: holder.href ?? undefined, copyable: true,
        missingLabel: holder.status === 'loading' ? t('checkingHolder') : missing,
      };
    }
    const item = provenance[key];
    return {
      id: key,
      label,
      value: item.value,
      source: sourceLabel(t, item.source),
      href: item.href ?? undefined,
      missingLabel: missing,
      copyable: key !== 'token',
    };
  });
}

function statusFor(score: ScorePageData): EditionStatus {
  if (score.state === 'processing') return 'processing';
  if (score.state === 'failed' && score.publicFailure === 'snapshot_unavailable') return 'degraded';
  if (score.state === 'failed') return 'failed';
  return score.degraded ? 'degraded' : 'finalized';
}

function dateLabel(score: ScorePageData, missing: string): string {
  const value = score.confirmedAt ?? score.createdAt ?? score.mintedAt;
  if (!value) return missing;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN');
}

export default function ScoreArchive({
  score, holder,
}: { score: ScorePageData; holder?: ScoreHolderState }) {
  const t = useTranslations('score.archive');
  const token = score.tokenId == null ? t('inProgress') : `Token #${score.tokenId}`;
  return (
    <section className="score-archive" aria-labelledby="score-archive-title">
      <div className="score-archive__intro">
        <p className="score-archive__eyebrow">{t('eyebrow')}</p>
        <h2 id="score-archive-title">{t('title')}</h2>
        <p>{t('intro')}</p>
        {score.provenance.decoder.href && (
          <a className="score-archive__decoder" href={score.provenance.decoder.href} target="_blank" rel="noopener noreferrer">
            {t('openDecoder')} <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
      <ProvenanceLedger entries={ledgerEntries(t, score.provenance, holder)} />
      <div className="score-archive__edition">
        <EditionStamp status={statusFor(score)} detail={`${token} · ${dateLabel(score, t('dateMissing'))}`} />
      </div>
    </section>
  );
}
