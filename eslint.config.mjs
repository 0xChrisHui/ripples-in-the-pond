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
    // Foundry 项目（Solidity + OZ 库自带的 JS 测试）
    "contracts/**",
  ]),
]);

export default eslintConfig;
