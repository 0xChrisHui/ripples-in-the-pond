import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAddress } from 'viem';
import PackView from '@/src/components/score-pack/PackView';

type Props = { params: Promise<{ id: string; contract: string; tokenId: string }> };

export const metadata: Metadata = {
  title: 'Score pack · Ripples in the Pond',
  robots: { index: false, follow: false },
};

/** 多链路由里 [id] 实际是 chainId（与旧 /score/[id] 的 tokenId/UUID 含义不同）。 */
export default async function ScorePackPage({ params }: Props) {
  const { id, contract, tokenId } = await params;
  const chainId = Number(id);
  if (![1, 10, 11155111, 11155420].includes(chainId) || !/^[1-9]\d{0,15}$/.test(tokenId) || BigInt(tokenId) > BigInt(Number.MAX_SAFE_INTEGER)) notFound();
  let address: string;
  try { address = getAddress(contract); } catch { notFound(); }
  return <PackView target={{ chainId, contract: address, tokenId: Number(tokenId) }} />;
}
