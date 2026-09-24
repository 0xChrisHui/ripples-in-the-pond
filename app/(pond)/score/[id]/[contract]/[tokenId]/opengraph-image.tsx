import { ImageResponse } from 'next/og';
import { getMultichainScore } from '@/src/data/score/multichain';
import { getChainDefinition } from '@/src/lib/chain/multichain/registry';

export const runtime = 'nodejs';
export const alt = 'Ripples in the Pond — 多链永久唱片';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ id: string; contract: string; tokenId: string }> };

export default async function MultichainOgImage({ params }: Props) {
  const { id, contract, tokenId } = await params;
  const score = await getMultichainScore(id, contract, tokenId);
  const network = score ? getChainDefinition(score.chainId).displayName : 'Ethereum';
  const title = score?.tokenId ? `Ripples #${score.tokenId}` : 'Ripples in the Pond';
  const track = score?.trackTitle ?? '永久音乐唱片';
  const events = score?.eventCount == null ? '永久作品' : `${score.eventCount} 个永久事件`;
  return new ImageResponse(
    <div style={{
      display: 'flex', position: 'relative', width: '100%', height: '100%',
      flexDirection: 'column', justifyContent: 'space-between', padding: '66px 72px',
      background: 'radial-gradient(circle at 25% 60%, #233026, #070706 55%)',
      color: '#e3dccf', fontFamily: 'Georgia, serif',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c3a15f',
        fontFamily: 'monospace', fontSize: 17, letterSpacing: '.16em' }}>
        <span>RIPPLES IN THE POND</span><span>{network.toUpperCase()}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 68 }}>
        <div style={{ display: 'flex', width: 330, height: 330, alignItems: 'center',
          justifyContent: 'center', border: '2px solid rgba(227,220,207,.28)', borderRadius: '50%',
          background: 'radial-gradient(circle at 42% 35%, #363226, #030403 70%)',
          boxShadow: '0 36px 90px rgba(0,0,0,.65)', color: '#c3a15f', fontSize: 92 }}>R</div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span style={{ color: '#c3a15f', fontFamily: 'monospace', fontSize: 17,
            letterSpacing: '.14em' }}>PERMANENT SCORE · SELF-PAID GAS</span>
          <span style={{ marginTop: 30, fontSize: 70 }}>{title}</span>
          <span style={{ marginTop: 20, color: '#aaa397', fontSize: 30 }}>{track}</span>
          <span style={{ marginTop: 14, color: '#7f796f', fontFamily: 'monospace',
            fontSize: 18 }}>{events}</span>
        </div>
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid rgba(227,220,207,.2)',
        paddingTop: 24, color: '#aaa397', fontFamily: 'monospace', fontSize: 15 }}>
        CHAIN ID {id} · VERIFY ONCHAIN · PLAY FROM ARWEAVE
      </div>
    </div>,
    { ...size },
  );
}
