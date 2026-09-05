import ArchiveRow from '@/src/components/p11/ArchiveRow';
import ProvenanceLedger, { type ProvenanceEntry } from '@/src/components/p11/ProvenanceLedger';
import type { ScorePageData } from '@/src/data/score-source';
import { TOKEN_ONE, TOKEN_ONE_URI, TOKEN_ONE_URLS } from './token-one-provenance';

function arEntry(id: string, label: string, txId: string, href: string): ProvenanceEntry {
  return { id, label, value: `ar://${txId}`, source: '永久 Arweave 资源', href };
}

export default function TokenOneArchive({ score }: { score: ScorePageData }) {
  const entries: ProvenanceEntry[] = [
    {
      id: 'contract', label: 'ScoreNFT 合约', value: TOKEN_ONE.contract,
      source: 'OP Mainnet', href: TOKEN_ONE_URLS.contract,
    },
    {
      id: 'token', label: 'Token ID', value: TOKEN_ONE.tokenId,
      displayValue: '#001', source: 'ScoreNFT.tokenURI(1)', copyable: false,
    },
    {
      id: 'holder', label: '核验时持有人', value: TOKEN_ONE.holderAtBlock,
      source: `ownerOf(1) · 区块 ${TOKEN_ONE.verifiedBlock}`,
    },
    {
      id: 'creator', label: '创作者地址', value: score.creatorAddress,
      source: '作品队列关联账号', missingLabel: '当前数据源未提供创作者地址',
    },
    {
      id: 'mint', label: 'Mint 交易', value: score.txHash ?? TOKEN_ONE.mintTx,
      source: 'OP Mainnet transaction receipt', href: score.etherscanUrl ?? TOKEN_ONE_URLS.mintTx,
    },
    {
      id: 'set-uri', label: 'setURI 交易', value: TOKEN_ONE.setUriTx,
      source: 'OP Mainnet transaction receipt', href: TOKEN_ONE_URLS.setUriTx,
    },
    {
      id: 'token-uri', label: 'tokenURI', value: TOKEN_ONE_URI,
      source: 'ScoreNFT.tokenURI(1)', href: TOKEN_ONE_URLS.metadata,
    },
    arEntry('metadata', 'Metadata', TOKEN_ONE.metadataTx, TOKEN_ONE_URLS.metadata),
    arEntry('events', 'Events', TOKEN_ONE.eventsTx, TOKEN_ONE_URLS.events),
    arEntry('base', 'Base audio', TOKEN_ONE.baseTx, TOKEN_ONE_URLS.base),
    arEntry('sounds', 'Sounds map', TOKEN_ONE.soundsTx, TOKEN_ONE_URLS.sounds),
    {
      id: 'decoder', label: '永久 Decoder', value: TOKEN_ONE_URLS.decoder,
      source: 'Metadata animation_url 原文', href: TOKEN_ONE_URLS.decoder,
    },
  ];

  return (
    <section className="score-archive" aria-labelledby="score-archive-title" data-pond-ui="true">
      <div className="score-archive__intro">
        <p className="score-archive__eyebrow">Permanent provenance</p>
        <h2 id="score-archive-title">这片水域记住了什么</h2>
        <p>下列值来自 Token #1 的公开链上与永久资源；短显只为阅读，复制始终保留完整原文。</p>
      </div>

      <ProvenanceLedger entries={entries} />

      <div className="score-archive__edition" aria-label="版本记录">
        <ArchiveRow
          edition={1}
          title={TOKEN_ONE.name}
          status="finalized"
          statusDetail="OP Mainnet"
          date={TOKEN_ONE.mintedDate}
          dateTime={TOKEN_ONE.mintedDate}
          href="/score/1"
          actionLabel="查看当前作品"
        />
      </div>
    </section>
  );
}
