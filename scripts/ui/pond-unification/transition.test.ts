import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialRouteTransaction, routeTransactionReducer as reduce } from '../../../src/components/pond-shell/transition/route-reducer';
import { routeForPath } from '../../../src/components/pond-shell/transition/types';
import { interpolatePresence } from '../../../src/components/pond-shell/motion/scene-presence';

test('五类池塘全部20个方向按各自generation交接，重复ready幂等', () => {
  const paths = ['/', '/me', '/tracks', '/artist', '/score/1'];
  for (const source of paths) for (const destination of paths) {
    if (source === destination) continue;
    const initial = initialRouteTransaction(source);
    const start = reduce(initial, { type: 'start', target: routeForPath(destination), href: destination, at: 1 });
    assert.equal(start.interactiveOwner, routeForPath(source));
    const event = { type: 'ready' as const, owner: routeForPath(destination), generation: start.generation, at: 2 };
    const ready = reduce(start, event);
    assert.equal(reduce(ready, event), ready);
    const reveal = reduce(ready, { type: 'reveal', generation: start.generation, at: 3 });
    assert.equal(reveal.interactiveOwner, routeForPath(destination));
    const reverse = reduce(reveal, { type: 'start', target: routeForPath(source), href: source, at: 4 });
    assert.equal(reduce(reverse, event), reverse);
  }
});

test('退场与入场互补，快速反向从当前亮度续接，无跳变', () => {
  const incoming = interpolatePresence(0, 1, 180, 520);
  const outgoing = interpolatePresence(1, 0, 180, 520);
  assert.ok(incoming > 0 && incoming < 1);
  assert.equal(incoming + outgoing, 1);
  assert.equal(interpolatePresence(incoming, 0, 0, 520), incoming);
  assert.ok(interpolatePresence(incoming, 0, 16, 520) < incoming);
  assert.equal(interpolatePresence(incoming, 0, 520, 520), 0);
});

test('原曲、Echo、恢复地址不会误被当作私人档案或Score', () => {
  assert.equal(routeForPath('/score/material/1/0x123/1'), 'tracks');
  assert.equal(routeForPath('/echo/1'), 'echo');
  assert.equal(routeForPath('/echo/origin/0x123'), 'echo');
  assert.equal(routeForPath('/me/material/0x123'), 'detail');
  assert.equal(routeForPath('/me?mintOrder=x'.split('?')[0]), 'archive');
});
