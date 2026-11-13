import { useFormatter, useTranslations } from 'next-intl';
import ProvenanceLedger from '@/src/components/p11/ProvenanceLedger';
import type { ScorePageData } from '@/src/data/score-source';
import type { ScoreHolderState } from '../use-score-holder';
import { getChainDefinition } from '@/src/lib/chain/multichain/registry';

export default function WorkSummary({ score, holder }: { score: ScorePageData; holder?: ScoreHolderState }) {
  const t = useTranslations('score.archive'), format = useFormatter();
  const minted = score.confirmedAt ?? score.createdAt ?? score.mintedAt;
  const date = minted ? format.dateTime(new Date(minted), { year: 'numeric', month: 'numeric', day: 'numeric' }) : t('dateMissing');
  const chain = getChainDefinition(score.chainId ?? 10).displayName;
  const source = t('sources.contract');
  return <section className="score-work-summary" aria-labelledby="score-summary-title">
    <h2 id="score-summary-title">{t('summaryTitle')}</h2>
    <ProvenanceLedger compact entries={[
      { id: 'creator', label: t('fields.creator'), value: score.provenance.creator.value, source, href: score.provenance.creator.href ?? undefined },
      { id: 'holder', label: t('fields.currentHolder'), value: holder?.value ?? score.provenance.currentHolder.value, source, href: holder?.href ?? score.provenance.currentHolder.href ?? undefined, warning: holder?.status === 'unavailable' },
      { id: 'date', label: t('mintedDate'), value: date, source: t('sources.database'), copyable: false },
      { id: 'chain', label: t('chainTitle'), value: `${chain} · #${score.tokenId ?? '—'}`, source, copyable: false, href: score.provenance.contract.href ?? undefined },
    ]} />
  </section>;
}
