import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { assertProductionLegacyScoreConfig } from "./src/data/score/legacy-identity";

// P19：next-intl 无路由模式，服务端配置固定中文（见 src/i18n/request.ts）
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

assertProductionLegacyScoreConfig(process.env);

const nextConfig: NextConfig = {
  async rewrites() {
    const configured = process.env.MEDIA_BLOB_ORIGIN?.trim();
    if (!configured) return [];
    let origin: URL;
    try { origin = new URL(configured); }
    catch { throw new Error('MEDIA_BLOB_ORIGIN 必须是完整 HTTPS Blob origin'); }
    if (origin.protocol !== 'https:' || origin.username || origin.password
      || origin.pathname !== '/' || origin.search || origin.hash
      || origin.hostname === 'pond-ripple.xyz') {
      throw new Error('MEDIA_BLOB_ORIGIN 只允许不含路径、凭证与参数的外部 HTTPS origin');
    }
    // 💭 为什么不删除旧改写：切换镜像后已打开的页面仍会继续访问同源媒体地址。
    return [{ source: '/media/:txid([a-zA-Z0-9_-]{43})', destination: `${origin.origin}/media/:txid` }];
  },
};

export default withNextIntl(nextConfig);
