import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAddress } from 'viem';
import EchoPage from '@/src/components/echo/EchoPage';
import EchoUnavailable from '@/src/components/echo/EchoUnavailable';
import { getEchoByOriginCached } from '@/src/data/echo/source';

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  if (!isAddress(address)) return { title: 'Pond Echo 不存在 · Ripples in the Pond' };
  try {
    const echo = await getEchoByOriginCached(address);
    if (!echo) return { title: 'Pond Echo 不存在 · Ripples in the Pond' };
    return {
      title: `${echo.metadata.name} · Ripples in the Pond`,
      description: echo.metadata.description,
      alternates: { canonical: `/echo/origin/${echo.originWallet}` },
    };
  } catch { return { title: 'Pond Echo 暂不可用 · Ripples in the Pond' }; }
}

export default async function EchoOriginPage({ params }: Props) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  let echo;
  try {
    echo = await getEchoByOriginCached(address);
  } catch (error) {
    console.error('[echo-origin-page] permanent data unavailable:', address, error);
    return <EchoUnavailable message="来源钱包已经固定，但链上或永久网关暂时没有返回可核验的完整作品。系统不会用临时数据替代。" />;
  }
  if (!echo) notFound();
  return <EchoPage echo={echo} />;
}
