import { ImageResponse } from 'next/og';
import { getScoreById } from '@/src/data/score-source';

/**
 * /score/[id] 的动态 OG 分享卡
 * Next.js 自动在 <meta og:image> 中引用此路由生成的图片。
 * 微信/Twitter 分享时自动展示封面 + 曲目名 + 品牌。
 *
 * B8：路由 ID 双兼容（tokenId 数字 / queue.id UUID）。未上链草稿也会出 OG，
 * 但卡片标题用"上链中"代替 #{tokenId}。
 */

export const runtime = 'nodejs';
export const alt = 'Ripples in the Pond — Score NFT';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ id: string }> };

export default async function OgImage({ params }: Props) {
  const { id } = await params;
  const score = await getScoreById(id);
  if (!score) return fallbackImage();

  // 预取封面：Satori <img> 内部 fetch 失败会整个崩，
  // 所以先手动 fetch，成功才传 src，否则降级色块。
  let coverSrc: string | null = null;
  if (score.coverUrl) {
    try {
      const resp = await fetch(score.coverUrl, {
        signal: AbortSignal.timeout(4000),
      });
      if (resp.ok) coverSrc = score.coverUrl;
    } catch {
      // ESET / 网络不可达 → 降级色块
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#000',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 60,
          padding: 60,
        }}
      >
        {/* 封面：预取成功用图，否则降级色块 */}
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverSrc}
            alt=""
            width={360}
            height={360}
            style={{ borderRadius: 16, objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 360,
              height: 360,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #1e3a5f, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 120,
              opacity: 0.4,
            }}
          >
            ♫
          </div>
        )}

        {/* 文字区域 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxWidth: 600,
          }}
        >
          <div
            style={{
              fontSize: 18,
              letterSpacing: '0.15em',
              opacity: 0.5,
              textTransform: 'uppercase',
            }}
          >
            Ripples in the Pond
          </div>
          <div style={{ fontSize: 48, fontWeight: 300, lineHeight: 1.2 }}>
            {score.tokenId != null ? `Ripples #${score.tokenId}` : 'Ripples · 上链中'}
          </div>
          <div style={{ fontSize: 24, opacity: 0.6 }}>
            {score.trackTitle}
          </div>
          <div style={{ fontSize: 18, opacity: 0.35, marginTop: 8 }}>
            {score.eventCount} events
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function fallbackImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#000',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: 200,
            letterSpacing: '0.12em',
            opacity: 0.6,
          }}
        >
          Ripples in the Pond
        </div>
      </div>
    ),
    { ...size },
  );
}
