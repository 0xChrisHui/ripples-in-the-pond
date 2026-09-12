export async function retry(action, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { return await action(); } catch (error) { lastError = error; }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`${label} 超时：${lastError instanceof Error ? lastError.message : lastError}`);
}

/** 浏览器审计只读快照；字符串在页面上下文执行，不依赖 Node 运行时。 */
export const snapshotExpression = `(() => {
  const identity = Object.fromEntries([...document.querySelectorAll('.echo-identity > div')]
    .map(row => [row.querySelector('dt')?.textContent?.trim(), row.querySelector('dd')?.title]));
  const ledger = Object.fromEntries([...document.querySelectorAll('.provenance-ledger__row')]
    .map(row => [row.querySelector('dt')?.textContent?.trim(), row.querySelector('code')?.title]));
  const times = [...document.querySelectorAll('.echo-player__time time')].map(node => node.textContent?.trim());
  return {
    state: document.querySelector('.echo-player')?.dataset.state,
    network: document.querySelector('.echo-page__nav p')?.textContent?.trim(),
    recipe: document.querySelector('.echo-recipe code')?.textContent?.trim(),
    originHero: identity['原始创作者'], ownerHero: identity['当前持有人'],
    originLedger: ledger['Origin wallet'], ownerLedger: ledger['Current owner'],
    contractLedger: ledger['P14 contract'], transferNote: Boolean(document.querySelector('.echo-transfer-note')),
    segment: document.querySelector('.echo-player__body h2')?.textContent?.trim(),
    statusText: document.querySelector('.echo-player__status')?.textContent?.trim(),
    actionText: document.querySelector('.echo-player__action')?.textContent?.trim(), times,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;
