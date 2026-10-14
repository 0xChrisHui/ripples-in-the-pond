import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { assertProductionLegacyScoreConfig } from "./src/data/score/legacy-identity";

// P19：next-intl 无路由模式，服务端配置固定中文（见 src/i18n/request.ts）
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

assertProductionLegacyScoreConfig(process.env);

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
