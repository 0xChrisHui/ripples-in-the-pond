import { mkdir, writeFile } from 'node:fs/promises';
import { openEdge, wait, writeEvidence } from '../lib/edge-cdp.mjs';
const edge = await openEdge({ port: 9230, profile: '.edge-i7-profile' });
const { send, evaluate, until, load, errors, requests, on, close } = edge;
const fixtureScores = [1, 2, 3, 4].map((sourceToken) => ({
  id: String(sourceToken === 3 ? 99_999_999 : sourceToken), queueId: `fixture-${sourceToken}`,
  tokenId: sourceToken === 3 ? 99_999_999 : sourceToken, status: 'success',
  trackTitle: `Fixture track ${sourceToken}`, eventCount: sourceToken + 2,
  failureKind: null, submittedAt: '2026-09-24T00:00:00.000Z',
})).concat([
  { id: 'fixture-processing', queueId: 'fixture-processing', status: 'preparing_package',
    trackTitle: 'Processing fixture', eventCount: 2, failureKind: null,
    submittedAt: '2026-09-24T00:00:00.000Z' },
  { id: 'fixture-failed', queueId: 'fixture-failed', status: 'failed',
    trackTitle: 'Failed fixture', eventCount: 2, failureKind: 'safe_retry',
    submittedAt: '2026-09-24T00:00:00.000Z' },
]);
const fixtureByPath = new Map([
  ['/api/me/score-nfts', { scoreNfts: fixtureScores }],
  ['/api/me/scores', { scores: [] }],
  ['/api/me/nfts', { nfts: [] }],
  ['/api/me/pond-echoes', { echoes: [], onChainTotal: 0, truncated: false,
    originStatusUnavailable: false }],
]);
const intercepted = [];
function fulfill(requestId, status, value) {
  return send('Fetch.fulfillRequest', {
    requestId, responseCode: status,
    responseHeaders: [{ name: 'content-type', value: 'application/json; charset=utf-8' }],
    body: Buffer.from(JSON.stringify(value)).toString('base64'),
  }); }
async function archiveSnapshot(label) {
  return evaluate(`(() => { const active=document.querySelector('.pond-prepared-archive');
    const selected=document.querySelector('[data-score-origin-selected="true"]');
    return { label:${JSON.stringify(label)}, path:location.pathname, scrollY,
      page:document.querySelector('[data-archive-section="records"]')?.dataset.archivePage,
      stage:document.querySelector('.me-archive')?.dataset.scoreOriginStage ?? null,
      selected: selected?.dataset.scoreOriginKey ?? null,
      named:[...document.querySelectorAll('*')].filter(n=>getComputedStyle(n).viewTransitionName==='score-record').length,
      focused:document.activeElement?.closest('[data-score-origin-key]')?.dataset.scoreOriginKey ?? null,
      busy:document.querySelector('[aria-busy="true"]')?.dataset.scoreOriginKey ?? null,
      interactive:active?.dataset.interactive ?? null }; })()`);
}
async function scoreSnapshot(label) {
  return evaluate(`(() => { const anchor=document.querySelector('[data-score-token-id]');
    return { label:${JSON.stringify(label)}, path:location.pathname,
      token:anchor?.dataset.scoreTokenId ?? null,
      ready:anchor?.dataset.scoreAnchorReady ?? null,
      name:anchor ? getComputedStyle(anchor).viewTransitionName : null,
      sourceStage:document.querySelector('.me-archive')?.dataset.scoreOriginStage ?? null,
      named:[...document.querySelectorAll('*')].filter(n=>getComputedStyle(n).viewTransitionName==='score-record').length,
      state:document.querySelector('main[data-score-state]')?.dataset.scoreState ?? null }; })()`);
}
async function goArchivePage(page = 1) {
  await load('/me', `Boolean(document.querySelector('.me-archive__dashboard'))`);
  await until(`document.querySelector('[data-archive-section="records"]')?.dataset.archivePage==='0'`, '档案首屏');
  if (page === 1) {
    const clicked = await evaluate(`(() => { const buttons=[...document.querySelectorAll(
      '[data-archive-section="records"] .archive-section__pagination button')];
      buttons.at(-1)?.click(); return buttons.length; })()`);
    if (!clicked) throw new Error('档案分页按钮不存在');
    await until(`document.querySelector('[data-archive-section="records"]')?.dataset.archivePage==='1'`, '档案第二页');
  }
}
const result = { measuredAt: new Date().toISOString(), checks: {} };
try {
  on('Fetch.requestPaused', (event) => {
    const url = new URL(event.request.url);
    const path = url.pathname;
    intercepted.push({ method: event.request.method, path });
    const task = event.request.method !== 'GET' && path.startsWith('/api/me/')
      ? fulfill(event.requestId, 405, { error: 'fixture is read only' })
      : fixtureByPath.has(path) ? fulfill(event.requestId, 200, fixtureByPath.get(path))
        : send('Fetch.continueRequest', { requestId: event.requestId });
    void task.catch(() => undefined);
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Network.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const payload=btoa(JSON.stringify({sub:'i7-owner-a',evm:'0x1111111111111111111111111111111111111111',
      exp:Math.floor(Date.now()/1000)+3600})).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    localStorage.setItem('ripples_auth_jwt','e30.'+payload+'.fixture');
    window.__i7Pushes=[]; const push=history.pushState.bind(history);
    history.pushState=(state,title,url)=>{ window.__i7Pushes.push(String(url)); return push(state,title,url); };
  ` });
  await goArchivePage(1);
  result.pageTwo = await archiveSnapshot('page-two');
  result.nonReady = await evaluate(`(() => [...document.querySelectorAll('.me-archive-row')]
    .filter(row=>row.dataset.status!=='success').map(row=>({status:row.dataset.status,
      name:getComputedStyle(row).viewTransitionName,href:row.querySelector('a')?.getAttribute('href')})))()`);
  await evaluate(`scrollTo(0, document.querySelector('[data-score-origin-key="score-fixture-4"]')
    .getBoundingClientRect().top + scrollY - 180); true`);
  const sourceScroll = await evaluate('scrollY');
  await evaluate(`document.querySelector('[data-score-origin-key="score-fixture-4"] a').focus(); true`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until(`location.pathname==='/score/4' && document.querySelector('main[data-score-state]')
    ?.dataset.scoreState==='ready'`, '键盘进入 Score', 60_000);
  result.forward = await scoreSnapshot('keyboard-forward');
  await wait(1_000);
  await evaluate(`document.querySelector('.score-pond-header__back').click(); true`);
  await until(`location.pathname==='/me' && Boolean(document.querySelector('[data-score-origin-key="score-fixture-4"]'))`,
    '按钮返回档案', 30_000);
  await until(`!document.querySelector('.me-archive')?.dataset.scoreOriginStage`, '按钮恢复来源', 20_000);
  result.buttonReturn = await archiveSnapshot('button-return');
  result.buttonReturn.scrollDelta = Math.abs(result.buttonReturn.scrollY - sourceScroll);
  await evaluate(`document.querySelector('[data-score-origin-key="score-fixture-4"] a').click(); true`);
  await until(`location.pathname==='/score/4' && document.querySelector('main[data-score-state]')
    ?.dataset.scoreState==='ready'`, '再次进入 Score', 60_000);
  await wait(1_000);
  await evaluate('history.back(); true');
  await until(`location.pathname==='/me'`, '浏览器返回档案', 30_000);
  await wait(1_000);
  result.browserBack = await archiveSnapshot('browser-back');
  await evaluate(`(() => { const link=document.querySelector('[data-score-origin-key="score-fixture-4"] a');
    addEventListener('click', event=>event.preventDefault(), {once:true});
    link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,ctrlKey:true})); return true; })()`);
  await wait(500);
  result.modified = await archiveSnapshot('ctrl-click');
  await load('/score/4', `document.querySelector('main[data-score-state]')?.dataset.scoreState==='ready'`);
  result.direct = await scoreSnapshot('direct');
  await goArchivePage(0);
  await evaluate(`(() => { const one=document.querySelector('[data-score-origin-key="score-fixture-1"] a');
    const two=document.querySelector('[data-score-origin-key="score-fixture-2"] a');
    one.click(); one.click(); two.click(); return true; })()`);
  await until(`location.pathname==='/score/2' && Boolean(document.querySelector('[data-score-token-id="2"]'))`,
    '快速换目标以最后点击为准', 30_000);
  result.switchTarget = await scoreSnapshot('switch-target');
  result.scorePushes = await evaluate(`window.__i7Pushes.filter(path=>path.includes('/score/'))`);
  await evaluate(`(() => { const payload=btoa(JSON.stringify({sub:'i7-owner-b',
    evm:'0x2222222222222222222222222222222222222222',exp:Math.floor(Date.now()/1000)+3600}))
    .replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    localStorage.setItem('ripples_auth_jwt','e30.'+payload+'.fixture');
    dispatchEvent(new StorageEvent('storage',{key:'ripples_auth_jwt'})); return true; })()`);
  await until(`!document.querySelector('.me-archive')?.dataset.scoreOriginStage`, '身份切换清理来源');
  result.identityInvalidation = await scoreSnapshot('identity-switch');
  await goArchivePage(0);
  await evaluate(`document.querySelector('[data-score-origin-key="score-fixture-3"] a').click(); true`);
  await until(`location.pathname==='/me' && !document.querySelector('.me-archive')?.dataset.scoreOriginStage
    && !document.querySelector('[aria-busy="true"]')`, '目标失败自动收敛', 30_000);
  result.failedTarget = await archiveSnapshot('failed-target');
  await goArchivePage(0);
  await evaluate(`(() => { document.querySelector('[data-score-origin-key="score-fixture-3"] a').click();
    dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape'})); return true; })()`);
  await until(`location.pathname==='/me' && !document.querySelector('.me-archive')?.dataset.scoreOriginStage
    && !document.querySelector('[aria-busy="true"]')`,
    '失败导航 Escape 收敛', 10_000);
  result.failedEscape = await archiveSnapshot('failed-escape');
  result.writes = requests.filter(({ method, url }) => url.startsWith('http://127.0.0.1:3000')
    && !url.includes('/__nextjs_') && !['GET', 'HEAD', 'OPTIONS'].includes(method));
  result.intercepted = intercepted;
  result.errors = errors;
  const expected = (message) => message.includes('Failed to fetch')
    || message.includes('mainnet verified snapshot missing');
  result.expectedErrors = errors.filter(expected);
  const unexpectedErrors = errors.filter((message) => !expected(message));
  result.checks = {
    pageRestore: result.pageTwo.page === '1' && result.buttonReturn.page === '1'
      && result.buttonReturn.stage === null && result.buttonReturn.focused === 'score-fixture-4'
      && result.buttonReturn.scrollDelta < 3,
    anchoredForward: result.forward.token === '4' && result.forward.ready === 'true'
      && result.forward.name === 'score-record' && result.forward.named === 2,
    browserBack: result.browserBack.page === '1' && result.browserBack.stage === null
      && result.browserBack.focused === 'score-fixture-4',
    nativeSemantics: result.modified.path === '/me' && result.modified.stage === null
      && result.nonReady.every((row) => row.name === 'none'),
    directFallback: result.direct.ready === null && result.direct.name === 'none',
    lastIntent: result.switchTarget.path === '/score/2' && result.switchTarget.token === '2',
    identityInvalidation: result.identityInvalidation.sourceStage === null
      && result.identityInvalidation.name === 'none',
    failedTarget: result.failedTarget.path === '/me' && result.failedTarget.stage === null
      && result.failedTarget.busy === null,
    failedEscape: result.failedEscape.path === '/me' && result.failedEscape.stage === null
      && result.failedEscape.busy === null,
    readOnly: result.writes.length === 0,
    errors: unexpectedErrors.length === 0,
  };
  result.passed = Object.values(result.checks).every(Boolean);
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 76, fromSurface: true });
  await mkdir('reviews/evidence/p11-i/i7', { recursive: true });
  await writeFile('reviews/evidence/p11-i/i7/final-state.jpg', Buffer.from(data, 'base64'));
  const output = await writeEvidence('reviews/evidence/p11-i/i7/i7-anchor.json', result);
  console.log(`${result.passed ? 'I7 Anchor Gate 通过' : 'I7 Anchor Gate 失败'}：${output}`);
  if (!result.passed) process.exitCode = 1;
} finally {
  close();
}
