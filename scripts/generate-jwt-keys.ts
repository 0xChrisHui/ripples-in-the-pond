/**
 * 一次性脚本：生成 RS256 密钥对，输出 PEM 格式
 * 用法：npx tsx scripts/generate-jwt-keys.ts
 * 把输出的两个值贴入 .env.local
 */

import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";

async function main() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });

  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);

  // .env.local 里 PEM 要转成单行（换行替换为 \n）
  const privateOneLine = privatePem.trim().replace(/\n/g, "\\n");
  const publicOneLine = publicPem.trim().replace(/\n/g, "\\n");

  console.log("=== 把以下两行贴入 .env.local ===\n");
  console.log(`JWT_PRIVATE_KEY="${privateOneLine}"`);
  console.log();
  console.log(`JWT_PUBLIC_KEY="${publicOneLine}"`);
  console.log("\n=== 完成 ===");
}

main().catch((err) => {
  console.error("生成失败:", err);
  process.exit(1);
});
