import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';
import { getScoreById } from '@/src/data/score-source';

export const runtime = 'nodejs';
const SIZE = { width: 1080, height: 1920 };

function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://pond-ripple.xyz').replace(/\/$/, '');
}

function displayHost(): string {
  return appBase().replace(/^https?:\/\//, '');
}

async function availableCover(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = response.headers.get('content-type') ?? '';
    return response.ok && type.startsWith('image/') ? url : null;
  } catch { return null; }
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const score = await getScoreById(id);
  if (!score) return new Response('score not found', { status: 404 });
  const cover = await availableCover(score.coverUrl);
  const slug = score.tokenId == null ? score.id : String(score.tokenId);
  const title = score.tokenId == null ? 'Ripples · 制作中' : `Ripples #${score.tokenId}`;
  const edition = score.tokenId == null ? 'PRESSING IN PROGRESS' : `TOKEN #${String(score.tokenId).padStart(3, '0')}`;
  const events = score.eventCount == null ? '事件数待核验' : `${score.eventCount} 个永久事件`;
  const creator = score.creatorAddress ? shortAddress(score.creatorAddress) : null;
  const fullUrl = `${appBase()}/score/${slug}`;
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(fullUrl, {
      margin: 1, width: 220,
      color: { dark: '#e3dccf', light: '#00000000' },
    });
  } catch { /* QR 失败时保留品牌域名与作品身份。 */ }

  return new ImageResponse(
    <div style={{
      display: 'flex', position: 'relative', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden',
      alignItems: 'center', background: '#070706', color: '#e3dccf', fontFamily: 'Georgia, serif', padding: '86px 76px 82px',
    }}>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        background: 'radial-gradient(ellipse at 50% 43%, rgba(142,155,131,.20), transparent 40%), linear-gradient(180deg, #0c0b09 0%, #070706 78%)',
      }} />
      {[0, 1, 2, 3, 4].map((ring) => (
        <div key={ring} style={{
          position: 'absolute', left: -10 - ring * 72, top: 780 - ring * 34,
          width: 1100 + ring * 144, height: 210 + ring * 68, border: '1px solid rgba(227,220,207,.11)',
          borderRadius: '50%', transform: 'rotate(-3deg)',
        }} />
      ))}
      <div style={{ position: 'relative', display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', color: '#aaa397', fontFamily: 'monospace', fontSize: 18, letterSpacing: '.18em' }}>
        <span>RIPPLES IN THE POND</span><span>{edition}</span>
      </div>
      <div style={{ position: 'relative', display: 'flex', width: 88, marginTop: 56, borderTop: '2px solid #c3a15f' }} />
      <div style={{ position: 'absolute', top: 872, width: 760, height: 74, borderRadius: '50%', background: 'rgba(0,0,0,.52)' }} />
      <div style={{
        position: 'relative', display: 'flex', width: 720, height: 720, marginTop: 90,
        alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
        border: '2px solid rgba(227,220,207,.30)',
        background: 'radial-gradient(circle at 43% 36%, #292720 0%, #0b0c0b 29%, #010202 73%)',
        boxShadow: '0 44px 110px rgba(0,0,0,.68)',
      }}>
        {[0, 1, 2, 3, 4, 5, 6].map((groove) => (
          <div key={groove} style={{
            position: 'absolute', width: 650 - groove * 66, height: 650 - groove * 66,
            border: '1px solid rgba(227,220,207,.10)', borderRadius: '50%',
          }} />
        ))}
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" width={264} height={264} style={{ borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(195,161,95,.75)' }} />
        ) : (
          <div style={{ display: 'flex', width: 264, height: 264, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '4px solid #c3a15f', background: '#251d11', color: '#c3a15f', fontSize: 96 }}>R</div>
        )}
        <div style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: '#d8b870', border: '3px solid #070706' }} />
      </div>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 112, textAlign: 'center' }}>
        <div style={{ display: 'flex', color: '#c3a15f', fontFamily: 'monospace', fontSize: 18, letterSpacing: '.18em' }}>
          {score.state === 'ready' ? 'PERMANENT SCORE · 已定稿' : score.state === 'processing' ? '正在制作永久唱片' : '永久凭证仍可核验'}
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 82, fontWeight: 400, lineHeight: 1, letterSpacing: '-.025em' }}>{title}</div>
        <div style={{ display: 'flex', marginTop: 24, color: '#aaa397', fontSize: 38 }}>{score.trackTitle}</div>
        <div style={{ display: 'flex', marginTop: 18, color: '#7f796f', fontFamily: 'monospace', fontSize: 22 }}>{events}</div>
        {creator && <div style={{ display: 'flex', marginTop: 14, color: '#7f796f', fontFamily: 'monospace', fontSize: 20 }}>CREATOR · {creator}</div>}
      </div>
      <div style={{ position: 'relative', display: 'flex', width: '100%', marginTop: 'auto', paddingTop: 42, borderTop: '1px solid rgba(227,220,207,.20)', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ color: '#c3a15f', fontFamily: 'monospace', fontSize: 16, letterSpacing: '.16em' }}>LISTEN · VERIFY · KEEP</span>
          <span style={{ color: '#aaa397', fontFamily: 'monospace', fontSize: 24 }}>{score.tokenId == null ? displayHost() : `${displayHost()}/score/${score.tokenId}`}</span>
        </div>
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="" width={176} height={176} style={{ opacity: .9 }} />
        )}
      </div>
    </div>,
    {
      ...SIZE,
      headers: {
        'Content-Disposition': `inline; filename="ripples-${slug}.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
