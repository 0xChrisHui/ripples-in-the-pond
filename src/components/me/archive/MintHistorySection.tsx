'use client';

import { useMemo } from 'react';
import type { OwnedNFT } from '@/src/types/tracks';
import type { OwnedScoreNFT } from '@/src/types/score-mint';
import { explorerTxUrlFor, getChainDefinition } from '@/src/lib/chain/multichain/registry';
import ArchiveSection from './ArchiveSection';

type Entry = { key: string; title: string; kind: string; chain: string; state: string; time: string; href: string | null };
const LIMIT = 50;
const chainName = (chainId: number) => (chainId === 10 ? 'Optimism' : getChainDefinition(chainId).displayName.replace(' Mainnet', ''));
const SCORE_DONE = ['success'], SCORE_STOPPED = ['failed', 'manual_review', 'expired'];
const link = (chainId: number, hash?: string) => (hash ? explorerTxUrlFor(chainId, hash) : null);

/** 铸造记录：把唱片与原曲（含首页收藏）合成一条时间线，由已加载的档案数据拼出，不新增请求。 */
export default function MintHistorySection({ materials, scores, loading }: {
  materials: OwnedNFT[]; scores: OwnedScoreNFT[]; loading: boolean;
}) {
  const entries = useMemo<Entry[]>(() => [
    ...materials.map((nft): Entry => {
      const chainId = nft.chain_id ?? 10;
      return { key: `material-${nft.id ?? nft.tx_hash ?? nft.token_id}`, title: nft.track?.title ?? '收藏处理中',
        kind: nft.edition === 'eth' ? '原曲 NFT' : nft.edition === 'op_sbt' ? '原曲 SBT' : '首页收藏',
        chain: chainName(chainId), state: nft.status === 'pending' ? '处理中' : '已完成',
        time: nft.minted_at, href: link(chainId, nft.tx_hash) };
    }),
    ...scores.map((score): Entry => {
      const chainId = score.chainId ?? 10;
      return { key: `score-${score.queueId}`, title: score.trackTitle, kind: '唱片', chain: chainName(chainId),
        state: SCORE_DONE.includes(score.status) ? '已完成' : SCORE_STOPPED.includes(score.status) ? '需要处理' : '处理中',
        time: score.submittedAt, href: link(chainId, score.txHash) };
    }),
  ].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, LIMIT), [materials, scores]);
  return (
    <div className="me-archive__panel me-archive__panel--history">
      <ArchiveSection id="mint-history" title="铸造记录" count={entries.length} loading={loading}
        emptyDescription="唱片与原曲的铸造记录会出现在这里。">
        {entries.map((entry) => (
          <div key={entry.key} className="me-archive-row me-archive-row--history" data-status={entry.state === '已完成' ? 'success' : undefined}>
            <div className="me-archive-row__main"><h3>{entry.title}</h3>
              <p>{entry.chain} · {entry.kind} · {new Date(entry.time).toLocaleString('zh-CN', { hour12: false })}</p></div>
            <div className="me-archive-row__state">{entry.state}
              {entry.href && <a href={entry.href} target="_blank" rel="noreferrer">交易 ↗</a>}</div>
          </div>
        ))}
      </ArchiveSection>
    </div>
  );
}
