/**
 * EmptyState — 用户没有 NFT 时的提示
 */
export default function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-20">
      <p className="text-lg text-white/50">还没有收藏</p>
      <p className="text-sm text-white/30">
        去首页聆听音乐，铸造你喜欢的作品
      </p>
    </div>
  );
}
