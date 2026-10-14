'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { OwnedNFT } from '@/src/types/tracks';
import type { OwnedScoreNFT } from '@/src/types/score-mint';
import { explorerTxUrlFor, getChainDefinition } from '@/src/lib/chain/multichain/registry';
import ArchiveSection from './ArchiveSection';

type Kind = 'kindEth' | 'kindOp' | 'kindHome' | 'kindScore';
type State = 'pending' | 'done' | 'attention';
type Entry = { key: string; title: string | null; kind: Kind; chain: string; state: State; time: string; href: string | null };
const LIMIT = 50;
const chainName = (chainId: number) => (chainId === 10 ? 'Optimism' : getChainDefinition(chainId).displayName.replace(' Mainnet', ''));
const SCORE_DONE = ['success'], SCORE_STOPPED = ['failed', 'manual_review', 'expired'];
const link = (chainId: number, hash?: string) => (hash ? explorerTxUrlFor(chainId, hash) : null);

/** 铸造记录：把唱片与原曲（含首页收藏）合成一条时间线，由已加载的档案数据拼出，不新增请求。 */
export default function MintHistorySection({ materials, scores, loading }: {
  materials: OwnedNFT[]; scores: OwnedScoreNFT[]; loading: boolean;
}) {
  const t = useTranslations('me');
  const entries = useMemo<Entry[]>(() => [
    ...materials.map((nft): Entry => {
      const chainId = nft.chain_id ?? 10;
      return { key: `material-${nft.id ?? nft.tx_hash ?? nft.token_id}`, title: nft.track?.title ?? null,
        kind: nft.edition === 'eth' ? 'kindEth' : nft.edition === 'op_sbt' ? 'kindOp' : 'kindHome',
        chain: chainName(chainId), state: nft.status === 'pending' ? 'pending' : 'done',
        time: nft.minted_at, href: link(chainId, nft.tx_hash) };
    }),
    ...scores.map((score): Entry => {
      const chainId = score.chainId ?? 10;
      return { key: `score-${score.queueId}`, title: score.trackTitle, kind: 'kindScore', chain: chainName(chainId),
        state: SCORE_DONE.includes(score.status) ? 'done' : SCORE_STOPPED.includes(score.status) ? 'attention' : 'pending',
        time: score.submittedAt, href: link(chainId, score.txHash) };
    }),
  ].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, LIMIT), [materials, scores]);
  return (
    <div className="me-archive__panel me-archive__panel--history">
      <ArchiveSection id="mint-history" title={t('history.title')} count={entries.length} loading={loading}
        emptyDescription={t('history.empty')}>
        {entries.map((entry) => (
          <div key={entry.key} className="me-archive-row me-archive-row--history" data-status={entry.state === 'done' ? 'success' : undefined}>
            <div className="me-archive-row__main"><h3>{entry.title ?? t('material.processing')}</h3>
              <p>{entry.chain} · {t(`history.${entry.kind}`)} · {new Date(entry.time).toLocaleString('zh-CN', { hour12: false })}</p></div>
            <div className="me-archive-row__state">{t(`history.${entry.state}`)}
              {entry.href && <a href={entry.href} target="_blank" rel="noreferrer">{t('history.tx')}</a>}</div>
          </div>
        ))}
      </ArchiveSection>
    </div>
  );
}
