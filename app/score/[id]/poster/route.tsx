import { ImageResponse } from 'next/og';
import { getScoreById } from '@/src/data/score-source';

/**
 * GET /score/[id]/poster — 竖版可下载海报（P10-A A2，方案①：复用 OG 图管线）
 *
 * 1080×1920（9:16，story/朋友圈友好）。与 opengraph-image 同 next/og + nodejs runtime，
 * 封面预取降级逻辑同源照抄。首版不含二维码（底部印短链文字，二维码待 qrcode 装包报批后加）。
 * inline 出图便于直开预览；下载由 ShareBar 的 <a download> 触发。
 */

export const runtime = 'nodejs';

const SIZE = { width: 1080, height: 1920 };

function displayHost(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pond-ripple.xyz';
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  const score = await getScoreById(id);
  if (!score) {
    return new Response('score not found', { status: 404 });
  }

  // 预取封面：Satori <img> 内部 fetch 失败会整个崩，先手动 fetch，成功才传 src。
  let coverSrc: string | null = null;
  if (score.coverUrl) {
    try {
      const resp = await fetch(score.coverUrl, { signal: AbortSignal.timeout(4000) });
      if (resp.ok) coverSrc = score.coverUrl;
    } catch {
      // 网络不可达 → 降级色块
    }
  }

  const title = score.tokenId != null ? `Ripples #${score.tokenId}` : 'Ripples · 上链中';
  const slug = score.tokenId != null ? String(score.tokenId) : score.id;
  const shortAddr = score.creatorAddress
    ? `${score.creatorAddress.slice(0, 6)}...${score.creatorAddress.slice(-4)}`
    : '';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#000',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '120px 80px',
        }}
      >
        {/* 品牌标识 */}
        <div style={{ fontSize: 30, letterSpacing: '0.28em', opacity: 0.5, textTransform: 'uppercase' }}>
          Ripples in the Pond
        </div>

        {/* 封面 + 标题 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56 }}>
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverSrc} alt="" width={720} height={720} style={{ borderRadius: 28, objectFit: 'cover' }} />
          ) : (
            <div
              style={{
                width: 720,
                height: 720,
                borderRadius: 28,
                background: 'linear-gradient(135deg, #1e3a5f, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 240,
                opacity: 0.4,
              }}
            >
              ♫
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 76, fontWeight: 300, lineHeight: 1.1 }}>{title}</div>
            <div style={{ fontSize: 40, opacity: 0.6 }}>{score.trackTitle}</div>
            {shortAddr && (
              <div style={{ fontSize: 28, opacity: 0.35, fontFamily: 'monospace', marginTop: 8 }}>{shortAddr}</div>
            )}
            <div style={{ fontSize: 28, opacity: 0.3, marginTop: 8 }}>{score.eventCount} events</div>
          </div>
        </div>

        {/* 底部短链（二维码首版留白，后续接入） */}
        <div style={{ fontSize: 30, opacity: 0.45, fontFamily: 'monospace' }}>
          {displayHost()}/score/{slug}
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: {
        'Content-Disposition': `inline; filename="ripples-${slug}.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
