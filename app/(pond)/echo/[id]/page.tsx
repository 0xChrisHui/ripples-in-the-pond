import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EchoPage from '@/src/components/echo/EchoPage';
import EchoUnavailable from '@/src/components/echo/EchoUnavailable';
import { getEchoByTokenIdCached } from '@/src/data/echo/source';

type Props = { params: Promise<{ id: string }> };

function tokenIdFrom(value: string): bigint | null {
  return /^[1-9]\d*$/.test(value) ? BigInt(value) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tokenId = tokenIdFrom((await params).id);
  if (!tokenId) return { title: 'Pond Echo 不存在 · Ripples in the Pond' };
  try {
    const echo = await getEchoByTokenIdCached(tokenId);
    if (!echo) return { title: 'Pond Echo 不存在 · Ripples in the Pond' };
    return {
      title: `${echo.metadata.name} · Ripples in the Pond`,
      description: echo.metadata.description,
      alternates: { canonical: `/echo/origin/${echo.originWallet}` },
      openGraph: { title: echo.metadata.name, description: echo.metadata.description, type: 'music.song' },
    };
  } catch { return { title: 'Pond Echo 暂不可用 · Ripples in the Pond' }; }
}

export default async function EchoTokenPage({ params }: Props) {
  const tokenId = tokenIdFrom((await params).id);
  if (!tokenId) notFound();
  let echo;
  try {
    echo = await getEchoByTokenIdCached(tokenId);
  } catch (error) {
    console.error('[echo-page] permanent data unavailable:', tokenId.toString(), error);
    return <EchoUnavailable message="链上作品存在，但当前无法从两个独立网关取得一致的永久档案。请稍后重试；配方与所有权不会因此改变。" />;
  }
  if (!echo) notFound();
  return <EchoPage echo={echo} />;
}
