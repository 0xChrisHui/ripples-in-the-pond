/** 旧数字链接是已经发行的 OP 主网作品身份，不能跟随本地铸造环境切换。 */
export const LEGACY_SCORE_CHAIN_ID = 10;
export const LEGACY_SCORE_CONTRACT = '0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA';
export const LEGACY_SCORE_EXPLORER = 'https://optimistic.etherscan.io';

/** 正式部署仍必须使用 OP 主网铸造配置；测试网配置不能误进生产。 */
export function assertProductionLegacyScoreConfig(env: Record<string, string | undefined>): void {
  if (env.VERCEL_ENV !== 'production') return;
  if (env.NEXT_PUBLIC_CHAIN_ID !== String(LEGACY_SCORE_CHAIN_ID)
    || env.NEXT_PUBLIC_SCORE_NFT_ADDRESS?.toLowerCase() !== LEGACY_SCORE_CONTRACT.toLowerCase()) {
    throw new Error('正式环境的 OP ScoreNFT 链号或合约地址与既有唱片身份不一致');
  }
}
