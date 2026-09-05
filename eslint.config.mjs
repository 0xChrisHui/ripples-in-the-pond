import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 项目工具链（不是 web 应用代码，用 Node.js CommonJS 写法）
    ".claude/hooks/**",
    "scripts/**",
    // 浏览器视觉验收与诊断使用的临时用户配置
    ".tmp-*/**",
    // reviews 只保存结果与脚本，Edge 用户配置不是项目源码
    "reviews/evidence/**/edge-profile/**",
    // 项目统一临时目录（缓存隔离、诊断产物，不属于源码）
    ".tmp/**",
    // Foundry 项目（Solidity + OZ 库自带的 JS 测试）
    "contracts/**",
    // 第三方参考代码（Patatap 等）
    "references/**",
  ]),
]);

export default eslintConfig;
