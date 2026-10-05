import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const origin = process.env.TRACKS_TEST_ORIGIN ?? 'http://127.0.0.1:3121';
const preview = process.env.TRACKS_REVIEW_PASS === 'preview';
const interaction = process.env.TRACKS_REVIEW_PASS === 'interaction';
const singlePass = process.env.TRACKS_REVIEW_PASS === 'single';
const gridPass = process.env.TRACKS_REVIEW_PASS === 'grid';
const port = 9335;
const output = join(process.cwd(), 'reviews/evidence/tracks-redesign');
await mkdir(output, { recursive: true });
let browser;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try { await fetch(`http://127.0.0.1:${port}/json/version`); } catch {
  browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${port}`, `--user-data-dir=${join(process.cwd(), '.next/tracks-browser-profile')}`, 'about:blank',
  ], { stdio: 'ignore' });
}
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
  await sleep(100);
}
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${origin}/tracks`)}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')
    errors.push(message.params.args.map(item => item.value ?? item.description).join(' '));
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
});
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true });
});
function command(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function shot(name) {
  const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(output, `${name}.png`), Buffer.from(result.data, 'base64'));
}
async function waitFor(expression, limit = 8000) {
  for (let elapsed = 0; elapsed < limit; elapsed += 200) {
    if (await evaluate(expression)) return;
    await sleep(200);
  }
  throw new Error(`页面条件未满足：${expression}`);
}
async function viewport(name, width, height, path = '/tracks', count = 35) {
  if (gridPass) name = name.replace('v4', 'grid-v5');
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await command('Page.navigate', { url: `${origin}${path}` });
  await waitFor(`!!document.querySelector('.sound-imprint')`);
  await evaluate('document.fonts.ready.then(() => true)');
  await sleep(650);
  const layout = await evaluate(`(() => {
    const play = document.querySelector('.material-player__action').getBoundingClientRect();
    const title = document.querySelector('#track-title');
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      playTop: play.top, playBottom: play.bottom, items: document.querySelectorAll('[data-track-index-item]').length,
      titleSize: getComputedStyle(title.querySelector('strong')).fontSize,
      duration: document.querySelector('.material-seek')?.textContent, phase: document.querySelector('.material-player')?.dataset.phase };
  })()`);
  assert.equal(layout.items, count);
  assert.ok(layout.playTop >= 0 && layout.playBottom <= height, `${name}：首屏直接开听`);
  assert.ok(layout.scrollWidth <= width, `${name}：没有横向溢出`);
  assert.equal(layout.phase, 'idle');
  assert.ok(layout.duration.includes('1:11'), '首播前显示真实原曲时长');
  await shot(name);
  return layout;
}
const evidence = {};
try {
  await command('Page.enable'); await command('Runtime.enable');
  evidence.desktop = await viewport('desktop-v4', 1440, 900);
  if (gridPass) {
    const grid = await evaluate(`(() => {
      const list = document.querySelector('.track-index__viewport');
      const cells = [...list.querySelectorAll('button')].map(item => item.getBoundingClientRect());
      return { columns: new Set(cells.map(cell => cell.left)).size,
        rows: new Set(cells.map(cell => cell.top)).size, width: cells[0].width,
        square: cells.every(cell => Math.abs(cell.width - cell.height) < 1),
        visible: cells.every(cell => cell.top >= 0 && cell.bottom <= innerHeight) };
    })()`);
    assert.equal(grid.columns, 5); assert.equal(grid.rows, 7);
    assert.ok(grid.width >= 44 && grid.square && grid.visible, '35个方格全部可见且点击面积足够');
    evidence.grid = grid;
    await evaluate(`document.querySelector('[data-track-index-item="35"]').click()`);
    await waitFor(`document.querySelector('.track-archive').dataset.selectedTrack === '35'`);
    assert.equal(await evaluate(`document.querySelector('[data-track-index-item="35"]').getAttribute('aria-current')`), 'true');
  }
  if (!preview && !interaction && !singlePass && !gridPass) {
    await evaluate(`document.querySelector('.material-player__action').click()`);
    const immediate = await evaluate(`document.querySelector('.material-player').dataset.phase`);
    assert.ok(['preparing','playing'].includes(immediate), '点击后有真实准备状态');
    await waitFor(`document.querySelector('.material-player').dataset.phase === 'playing'`, 45000);
    const before = await evaluate(`Number(document.querySelector('[role=slider]').getAttribute('aria-valuenow'))`);
    await sleep(700);
    const after = await evaluate(`Number(document.querySelector('[role=slider]').getAttribute('aria-valuenow'))`);
    assert.ok(after > before, '真实音频播放时间推进');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.bottom-player-shell')).visibility`), 'hidden', '首屏只显示一组播放控制');
    evidence.playback = { immediate, before, after };
    await shot('desktop-playing-v4');
    await evaluate(`document.querySelector('#track-story').scrollIntoView()`);
    await sleep(200);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.bottom-player-shell')).visibility`), 'visible', '离开主控制才显示浮动播放器');
    await evaluate(`document.querySelector('.bottom-player__actions button:last-child').click()`);
    await waitFor(`document.querySelector('.material-player').dataset.phase === 'idle'`);
  }
  evidence.mobile = await viewport('mobile-v4', 390, 844);
  if (!preview) {
    await evaluate(`document.querySelector('.track-index__toggle').click()`);
    await sleep(100);
    assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), '关闭曲目目录');
    if (gridPass) await shot('mobile-catalog-grid-v5');
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8 });
    assert.equal(await evaluate(`document.activeElement.dataset.trackIndexItem`), '35', '目录键盘焦点不能逃出面板');
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await waitFor(`document.activeElement.className === 'track-index__toggle'`);
    assert.equal(await evaluate(`document.activeElement.className`), 'track-index__toggle');
    await evaluate(`document.querySelector('.track-index__toggle').click(); document.querySelector('[data-track-index-item="31"]').click()`);
    await sleep(650);
    assert.equal(await evaluate(`document.querySelector('.track-archive').dataset.selectedTrack`), '31');
    if (!gridPass) {
    const story = await evaluate(`(() => {
      document.querySelector('#track-story').scrollIntoView();
      return { selected: document.querySelector('.track-archive').dataset.selectedTrack,
        length: document.querySelector('.track-story__copy').textContent.length,
        paragraphs: document.querySelectorAll('.track-story__copy p').length,
        overflow: document.documentElement.scrollWidth > innerWidth };
    })()`);
    assert.equal(story.selected, '31'); assert.ok(story.length > 500); assert.equal(story.overflow, false);
    evidence.longNote = story;
    await shot('mobile-note-v4');
    }
    evidence.smallMobile = await viewport('mobile-small-v4', 375, 667);
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sound-imprint')).animationName`), 'none');
    if (!gridPass && (singlePass || !interaction)) {
      const path = await evaluate(`document.querySelector('.material-provenance a[href^="/score/material/"]').getAttribute('href')`);
      evidence.single = await viewport('single-v4', 1024, 768, path, 0);
      await evaluate(`document.querySelector('.material-player__action').click()`);
      await waitFor(`document.querySelector('.material-player').dataset.phase === 'playing'`, 45000);
      const started = await evaluate(`Number(document.querySelector('[role=slider]').getAttribute('aria-valuenow'))`);
      await sleep(700);
      const advanced = await evaluate(`Number(document.querySelector('[role=slider]').getAttribute('aria-valuenow'))`);
      assert.ok(advanced > started, '单曲页真实播放时间推进');
      evidence.singlePlayback = { started, advanced };
      await evaluate(`document.querySelector('#track-story').scrollIntoView()`);
      await sleep(200);
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.bottom-player-shell')).visibility`), 'visible');
      await shot('single-note-playing-v4');
      await evaluate(`document.querySelector('.bottom-player__actions button:last-child').click()`);
      await waitFor(`document.querySelector('.material-player').dataset.phase === 'idle'`);
      evidence.singleFloatingStop = true;
    }
  }
  assert.deepEqual(errors, [], '浏览器不出现异常');
  await writeFile(join(output, gridPass ? 'browser-grid-v5.json' : preview ? 'preview-v4.json' : 'browser-v4.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  socket.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  browser?.kill();
}
