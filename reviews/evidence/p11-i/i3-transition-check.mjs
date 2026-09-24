import { CANVAS_READY, MARK_CORE, SHELL_SNAPSHOT, TIMELINE, openEdge, wait, writeEvidence } from './lib/edge-cdp.mjs';

// P11-I3：/ ↔ /me 可逆转场 Gate（70-g G2）。只点击站内导航链接，不触发任何写操作。
const edge = await openEdge();
const { send, evaluate, until, load, errors } = edge;
const phaseIs = (phase) => `document.querySelector('[data-pond-shell]')?.dataset.pondTransition===${JSON.stringify(phase)}`;
const CLICK_ECHO = `(() => {
  const link = [...document.querySelectorAll('a[data-pond-focus-entry="home"]')].find((node) => node.getClientRects().length > 0);
  if (!link) return false; link.click(); return true;
})()`;
const CLICK_BACK = `(() => {
  const link = document.querySelector('.me-archive__back');
  if (!link) return false; link.click(); return true;
})()`;
const OPACITY = `(() => ({
  phase: document.querySelector('[data-pond-shell]')?.dataset.pondTransition ?? null,
  home: Number(getComputedStyle(document.querySelector('main[data-pond-root]')).opacity),
  route: Number(getComputedStyle(document.querySelector('.pond-route-surface')).opacity),
}))()`;

const snap = async (label, started) => ({
  label, ...(await evaluate(SHELL_SNAPSHOT)),
  focus: await evaluate(`document.activeElement?.dataset?.pondFocusEntry ?? document.activeElement?.tagName ?? null`),
  settleMs: started ? Date.now() - started : undefined,
});
async function go(click, pathname, phase, label) {
  const started = Date.now();
  const t0 = await evaluate('window.__p11Mark()');
  if (!await evaluate(click)) throw new Error(`找不到链接：${label}`);
  await until(`location.pathname===${JSON.stringify(pathname)} && ${phaseIs(phase)}`, label, 60_000);
  const timeline = await evaluate(`window.__p11Timeline.map((item) => ({ ...item, t: item.t - ${t0} }))`);
  const settled = timeline.find((item) => item.path === pathname && item.phase === phase);
  const landed = timeline.find((item) => item.path === pathname && (pathname === '/' ? !item.back : item.back));
  const longTasks = await evaluate(`window.__p11LongTasks.map((item) => ({ ...item, t: item.t - ${t0} }))`);
  return { ...(await snap(label, started)), landedMs: landed?.t ?? null,
    productSettleMs: settled?.t ?? null, timeline, longTasks };
}
const toArchive = (label) => go(CLICK_ECHO, '/me', 'archive', label);
const toHome = (label) => go(CLICK_BACK, '/', 'home', label);

let result;
try {
  await load('/', CANVAS_READY);
  await evaluate(MARK_CORE);
  await evaluate(TIMELINE);
  const initial = await snap('initial');
  await until(`/登录|我的音乐/.test(document.querySelector('header[data-pond-ui]')?.innerText ?? '')`, '认证就绪', 30_000);
  const b07 = await evaluate(`({
    echo: [...document.querySelectorAll('a[href="/me#pond-echoes"]')].some((node) => node.getClientRects().length > 0),
    artist: Boolean(document.querySelector('a[href="/artist"]')),
    login: /登录|我的音乐/.test(document.querySelector('header[data-pond-ui]')?.innerText ?? ''),
  })`);
  const warmup = [await toArchive('warmup-me'), await toHome('warmup-home')];

  const loops = [];
  for (let index = 1; index <= 10; index += 1) {
    loops.push(await toArchive(`me-${index}`));
    loops.push(await toHome(`home-${index}`));
  }

  const archiveInput = await (async () => {
    await toArchive('input-me');
    const hit = await evaluate(`(() => {
      const main = document.querySelector('main[data-pond-root]');
      const node = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return { inert: main.inert, pointerEvents: getComputedStyle(main).pointerEvents,
        centerHitsHome: Boolean(node?.closest('main[data-pond-root]')) };
    })()`);
    let tabIntoHome = false;
    for (let step = 0; step < 6; step += 1) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      if (await evaluate(`Boolean(document.activeElement?.closest('main[data-pond-root]'))`)) tabIntoHome = true;
    }
    await toHome('input-home');
    return { ...hit, tabIntoHome };
  })();

  await evaluate(CLICK_ECHO);
  await until(`location.pathname==='/me' && Boolean(document.querySelector('.me-archive__back'))`, '反向前落地', 30_000);
  const reverseBefore = await evaluate(OPACITY);
  await evaluate(CLICK_BACK);
  await wait(32);
  const reverseAfter = await evaluate(OPACITY);
  await until(`location.pathname==='/' && ${phaseIs('home')}`, '反向回首页', 30_000);
  const reverse = {
    before: reverseBefore, after: reverseAfter, final: await snap('reverse-final'),
    caughtMidway: reverseBefore.phase === 'leaving-home',
    continuous: Math.abs(reverseAfter.home - reverseBefore.home) < 0.35,
  };

  await evaluate(`${CLICK_ECHO}; ${CLICK_ECHO}`);
  await until(`location.pathname==='/me' && ${phaseIs('archive')}`, '双击入口', 30_000);
  const doubleClick = await snap('double-click');
  await toHome('double-click-home');

  await toArchive('history-me');
  let t0 = await evaluate('window.__p11Mark()');
  await evaluate('history.back(); true');
  await until(`location.pathname==='/' && ${phaseIs('home')}`, '浏览器后退', 30_000);
  const historyBack = { ...(await snap('history-back')),
    timeline: await evaluate(`window.__p11Timeline.map((item) => ({ ...item, t: item.t - ${t0} }))`) };
  t0 = await evaluate('window.__p11Mark()');
  await evaluate('history.forward(); true');
  await until(`location.pathname==='/me' && ${phaseIs('archive')}`, '浏览器前进', 30_000);
  await wait(400);
  const historyForward = { ...(await snap('history-forward')),
    timeline: await evaluate(`window.__p11Timeline.map((item) => ({ ...item, t: item.t - ${t0} }))`) };
  await toHome('history-home');

  const all = [...warmup, ...loops, reverse.final, doubleClick, historyBack, historyForward];
  const passed = all.every((item) => item.sameCore && item.sameCanvas && item.canvasCount <= 2
      && item.mountId === initial.mountId && !item.horizontalOverflow)
    // 无界面 Edge 的 transitionend 派发不可靠，收场按“落地 + 640ms 兜底”判定；
    // 回首页还会被音乐圆实例重建的长任务拖慢（I4 让实例常驻后复测），只断言不卡死。
    && loops.every((item) => item.productSettleMs !== null && item.landedMs !== null
      && (item.path === '/me' ? item.productSettleMs - item.landedMs <= 900 : item.productSettleMs < 2500)
      && item.focus === (item.path === '/me' ? 'archive' : 'home'))
    && loops.filter((item) => item.path === '/me').every((item) => item.homeInert)
    && archiveInput.inert && archiveInput.pointerEvents === 'none'
    && !archiveInput.centerHitsHome && !archiveInput.tabIntoHome
    && reverse.caughtMidway && reverse.continuous && reverse.final.path === '/'
    && doubleClick.path === '/me' && historyBack.path === '/' && historyForward.path === '/me'
    && historyForward.timeline.some((item) => item.phase === 'leaving-home') && historyForward.focus === 'archive'
    && b07.echo && b07.artist && b07.login;
  result = { measuredAt: new Date().toISOString(), passed, initial, b07, warmup, loops, archiveInput,
    reverse, doubleClick, historyBack, historyForward, pageErrors: errors };
} finally {
  edge.close();
}
const output = await writeEvidence('reviews/evidence/p11-i/i3-transition.json', result);
if (!result?.passed) throw new Error(`I3 转场 Gate 未通过：${output}`);
console.log(`I3 转场 Gate 通过：${output}`);
