import { ImageResponse } from 'next/og';
import { getScoreById } from '@/src/data/score-source';

export const runtime = 'nodejs';
export const alt = 'Ripples in the Pond — 永久唱片';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ id: string }> };

async function availableCover(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = response.headers.get('content-type') ?? '';
    return response.ok && type.startsWith('image/') ? url : null;
  } catch { return null; }
}

function statusLabel(state: 'ready' | 'processing' | 'failed'): string {
  if (state === 'ready') return 'PERMANENT SCORE · 已定稿';
  if (state === 'processing') return 'PRESSING IN PROGRESS · 制作中';
  return 'ARCHIVE AVAILABLE · 凭证可核验';
}

export default async function OgImage({ params }: Props) {
  const { id } = await params;
  const score = await getScoreById(id);
  if (!score) return fallbackImage();
  const cover = await availableCover(score.coverUrl);
  const title = score.tokenId == null ? 'Ripples · 制作中' : `Ripples #${score.tokenId}`;
  const events = score.eventCount == null ? '事件数待核验' : `${score.eventCount} 个永久事件`;

  return new ImageResponse(
    <div style={{
      display: 'flex', position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: '#070706', color: '#e3dccf', fontFamily: 'Georgia, serif', padding: '54px 62px',
    }}>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        background: 'radial-gradient(ellipse at 33% 55%, rgba(142,155,131,.18), transparent 42%), linear-gradient(180deg, #0c0b09 0%, #070706 76%)',
      }} />
      {[0, 1, 2, 3].map((ring) => (
        <div key={ring} style={{
          position: 'absolute', left: 70 - ring * 38, top: 360 - ring * 22,
          width: 610 + ring * 76, height: 128 + ring * 44, border: '1px solid rgba(227,220,207,.12)',
          borderRadius: '50%', transform: 'rotate(-4deg)',
        }} />
      ))}
      <div style={{ position: 'absolute', left: 112, top: 486, width: 410, height: 46, borderRadius: '50%', background: 'rgba(0,0,0,.5)' }} />
      <div style={{
        position: 'relative', display: 'flex', width: 390, height: 390, marginTop: 72, marginLeft: 18,
        alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
        border: '1px solid rgba(227,220,207,.28)',
        background: 'radial-gradient(circle at 43% 36%, #292720 0%, #0b0c0b 28%, #010202 72%)',
        boxShadow: '0 28px 70px rgba(0,0,0,.6)',
      }}>
        {[0, 1, 2, 3, 4].map((groove) => (
          <div key={groove} style={{
            position: 'absolute', width: 344 - groove * 42, height: 344 - groove * 42,
            border: '1px solid rgba(227,220,207,.10)', borderRadius: '50%',
          }} />
        ))}
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" width={142} height={142} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(195,161,95,.72)' }} />
        ) : (
          <div style={{ display: 'flex', width: 142, height: 142, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', background: '#251d11', border: '2px solid #c3a15f', color: '#c3a15f', fontSize: 56 }}>R</div>
        )}
        <div style={{ position: 'absolute', width: 10, height: 10, borderRadius: '50%', background: '#d8b870', border: '2px solid #070706' }} />
      </div>
      <div style={{ position: 'relative', display: 'flex', flex: 1, flexDirection: 'column', marginLeft: 78, paddingTop: 34 }}>
        <div style={{ display: 'flex', color: '#c3a15f', fontFamily: 'monospace', fontSize: 15, letterSpacing: '.16em' }}>
          {statusLabel(score.state)}
        </div>
        <div style={{ display: 'flex', width: 54, marginTop: 24, borderTop: '1px solid #c3a15f' }} />
        <div style={{ display: 'flex', marginTop: 28, fontSize: 62, fontWeight: 400, lineHeight: 1.02, letterSpacing: '-.025em' }}>{title}</div>
        <div style={{ display: 'flex', marginTop: 22, color: '#aaa397', fontSize: 27 }}>{score.trackTitle}</div>
        <div style={{ display: 'flex', marginTop: 14, color: '#7f796f', fontFamily: 'monospace', fontSize: 17 }}>{events}</div>
        <div style={{ display: 'flex', marginTop: 'auto', paddingTop: 28, borderTop: '1px solid rgba(227,220,207,.18)', justifyContent: 'space-between', color: '#aaa397', fontFamily: 'monospace', fontSize: 14, letterSpacing: '.1em' }}>
          <span>RIPPLES IN THE POND</span><span>OP ARCHIVE</span>
        </div>
      </div>
    </div>,
    { ...size },
  );
}

function fallbackImage() {
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at 50% 60%, #151b17, #070706 66%)', color: '#e3dccf', fontFamily: 'Georgia, serif', fontSize: 48, letterSpacing: '.08em' }}>
      Ripples in the Pond
    </div>,
    { ...size },
  );
}
