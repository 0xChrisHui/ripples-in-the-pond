import type { NextConfig } from "next";
import { assertProductionLegacyScoreConfig } from "./src/data/score/legacy-identity";

assertProductionLegacyScoreConfig(process.env);

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
