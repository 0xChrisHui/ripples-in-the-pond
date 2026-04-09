import type { OwnedNFT } from '@/src/types/tracks';

/**
 * NFTCard — 个人页 NFT 卡片
 * 显示曲目名称、所属岛屿、铸造时间
 */
export default function NFTCard({ nft }: { nft: OwnedNFT }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-white/20" />
        <div>
          <p className="text-sm font-medium text-white">{nft.track.title}</p>
          <p className="text-xs text-white/40">{nft.track.island}</p>
        </div>
      </div>
      <div className="space-y-1 text-xs text-white/30">
        <p>Token #{nft.token_id}</p>
        <p>铸造于 {nft.minted_at}</p>
      </div>
    </div>
  );
}
