import type { OwnedNFT } from '@/src/types/tracks';

/** 素材只呈现 API 的真实名称、Token 与时间；旧页面没有外链，因此不补假入口。 */
export default function MaterialArchiveRow({ nft, index }: { nft: OwnedNFT; index: number }) {
  const pending = !nft.track || !nft.tx_hash;
  const title = nft.track?.title ?? `素材 #${nft.token_id}`;

  return (
    <article className="me-archive-row" data-status={pending ? 'processing' : 'finalized'}>
      <p className="me-archive-row__index">{String(index + 1).padStart(2, '0')} · MATERIAL</p>
      <div className="me-archive-row__main">
        <h3>{title}</h3>
        <p>Token #{nft.token_id}{nft.track?.island ? ` · ${nft.track.island}` : ''}</p>
        <time dateTime={nft.minted_at}>
          {pending ? '提交于' : '铸造于'} {new Date(nft.minted_at).toLocaleDateString('zh-CN')}
        </time>
      </div>
      <div className="me-archive-row__state">
        <span>{pending ? '等待上链' : '已收藏'}</span>
      </div>
    </article>
  );
}
