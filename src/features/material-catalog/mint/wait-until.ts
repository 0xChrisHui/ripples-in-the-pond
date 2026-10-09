/** 轮询等待条件成立（登录/钱包初始化）；超时返回 false，由调用方给出提示。 */
export async function waitUntil(check: () => boolean, timeoutMs = 20000, stepMs = 150): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  return true;
}
