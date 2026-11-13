import type { ReactNode } from 'react';
import ProvenanceLedger, { type ProvenanceEntry } from '@/src/components/p11/ProvenanceLedger';
import type { ScorePageData, ScoreProvenance } from '@/src/data/score-source';
import type { ScoreHolderState } from './use-score-holder';
import { useTranslations } from 'next-intl';
import WorkSummary from './archive/WorkSummary';

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
        warning: holder.status === 'unavailable',
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

export default function ScoreArchive({
  score, holder, children,
}: { score: ScorePageData; holder?: ScoreHolderState; children?: ReactNode }) {
  const t = useTranslations('score.archive');
  return (
    <section className="score-archive" aria-labelledby="score-archive-title">
      <WorkSummary score={score} holder={holder} />
      {children}
      <div className="score-archive__intro">
        <h2 id="score-archive-title">{t('title')}</h2>
        <p>{t('plainIntro')}</p>
      </div>
      <details className="score-archive__details"><summary>{t('expandFull', { count: 12 })}</summary>
        <ProvenanceLedger compact entries={ledgerEntries(t, score.provenance, holder)} groups={[
          { title: t('groups.identity'), ids: ['contract', 'token', 'creator', 'currentHolder'] },
          { title: t('groups.transactions'), ids: ['mintTransaction', 'setUriTransaction', 'tokenUri'] },
          { title: t('groups.files'), ids: ['metadata', 'events', 'base', 'sounds', 'decoder'] },
        ]} />
        {score.provenance.decoder.href && <a className="score-archive__decoder" href={score.provenance.decoder.href} target="_blank" rel="noopener noreferrer">{t('openDecoder')} ↗</a>}
      </details>
    </section>
  );
}
