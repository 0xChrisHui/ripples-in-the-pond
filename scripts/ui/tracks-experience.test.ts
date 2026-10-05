import assert from 'node:assert/strict';
import test from 'node:test';
import { initialRouteTransaction, routeTransactionReducer } from '../../src/components/pond-shell/transition/route-reducer';
import { initialTrackForView } from '../../src/lib/music-catalog/experience/route-selection';

const url = process.env.TRACKS_TEST_URL ?? 'http://127.0.0.1:3121/tracks';

test('曲目首屏输出可直接聆听的舞台语义', async () => {
  const response = await fetch(url);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /data-track-stage="true"/);
  assert.match(html, /data-track-playback="primary"/);
  assert.match(html, /data-track-motion="sound"/);
  assert.match(html, /data-track-edition="01"/);
  assert.match(html, /href="#track-story"/);
  assert.match(html, /回到北京的第一天，打开在柏林的第一天的曲子。/);
  assert.match(html, /开始聆听/);
  assert.match(html, /1:11/);
});

test('35 首目录与当前曲目由同一页面模型输出', async () => {
  const response = await fetch(url);
  const html = await response.text();
  assert.equal(response.status, 200);
  const items = html.match(/data-track-index-item=/g) ?? [];
  assert.equal(items.length, 35);
  assert.match(html, /data-selected-track="1"/);
  assert.match(html, /data-track-position="01\/35"/);
  assert.match(html, /aria-current="true"/);
});

test('两版直接呈现作者原文并按同一编号打开曲目', async () => {
  for (const path of ['/tracks', '/tracks/pond']) {
    const response = await fetch(new URL(`${path}?track=31`, url));
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /data-selected-track="31"/);
    assert.match(html, /不能对齐的回信/);
    assert.doesNotMatch(html, /声音之外，|还有这些。|作者的文字，保留原来的样子。|35 封写给时间的回信|下一封回信/);
    assert.match(html, path.endsWith('/pond') ? /data-track-surface="pond"/ : /data-track-surface="archive"/);
  }
  assert.ok(initialTrackForView({ track: '31' }));
  for (const track of ['0', '36', '031', 'x', ['31']]) assert.equal(initialTrackForView({ track }), undefined);
});

test('水波路由仅在对应前景就绪后交接，过期回调不能夺取交互权', () => {
  const home = initialRouteTransaction('/');
  const pending = routeTransactionReducer(home, { type: 'start', target: 'tracks', href: '/tracks/pond', at: 1 });
  const ready = routeTransactionReducer(pending, { type: 'ready', generation: pending.generation, owner: 'tracks', at: 2 });
  assert.equal(pending.interactiveOwner, 'home');
  assert.equal(routeTransactionReducer(pending, { type: 'ready', generation: pending.generation, owner: 'archive', at: 2 }), pending);
  const revealed = routeTransactionReducer(ready, { type: 'reveal', generation: ready.generation, at: 3 });
  assert.equal(revealed.interactiveOwner, 'tracks');
  const settled = routeTransactionReducer(revealed, { type: 'settle', generation: revealed.generation, pathname: '/tracks/pond', at: 4 });
  assert.equal(settled.current, 'tracks');
  const returning = routeTransactionReducer(settled, { type: 'start', target: 'home', href: '/', at: 5 });
  assert.equal(routeTransactionReducer(returning, { type: 'ready', generation: ready.generation, owner: 'tracks', at: 6 }), returning);
  assert.equal(initialRouteTransaction('/me').current, 'archive');
  assert.equal(initialRouteTransaction('/score/1').current, 'score');
});
