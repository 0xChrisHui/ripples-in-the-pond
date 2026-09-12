export const MATERIAL_NOT_MINTABLE = {
  error: '这首音乐仅供聆听，暂不提供 MaterialNFT 收藏',
  code: 'MATERIAL_NOT_MINTABLE',
  materialMintable: false,
} as const;

/** 只有数据库明确给出 true 才开放；缺字段也按 fail closed 处理。 */
export function canMintMaterial(value: unknown): value is true {
  return value === true;
}

/** worker 的最后一道链上防线：拒绝回调完成前不会返回可发送状态。 */
export async function guardMaterialMint(
  value: unknown,
  reject: () => Promise<void>,
): Promise<boolean> {
  if (canMintMaterial(value)) return true;
  await reject();
  return false;
}
