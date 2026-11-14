const assert = require('node:assert/strict');
const test = require('node:test');
const { load } = require('../p23/regressions/load.cjs');
const { hooks } = require('./hook-harness.cjs');

function setup() {
  const h = hooks(), calls = [];
  class Engine {
    snapshot = { state: 'loading', playRequested: false };
    getSnapshot = () => this.snapshot;
    subscribe = () => () => {};
    load(value) { calls.push(['load', value]); this.snapshot = { state: 'loading', playRequested: false }; return Promise.resolve(); }
    play() { calls.push(['play']); return Promise.resolve(); }
    toggle() { calls.push(['toggle']); return Promise.resolve(); }
    pause() { calls.push(['pause']); }
    seek() {}
    replay() { calls.push(['replay']); return Promise.resolve(); }
    destroy() { calls.push(['destroy']); return Promise.resolve(); }
  }
  const { useScorePlayback } = load('src/features/score-playback/use-score-playback.ts', {
    react: h.react, './engine': { ScorePlaybackEngine: Engine },
    '@/src/components/player/playback-focus': {
      requestPlaybackFocus: () => calls.push(['focus']), subscribePlaybackFocus: () => () => {},
    },
  });
  return { calls, render: input => h.render(() => useScorePlayback(input)), unmount: h.unmount };
}
test('浏览Score不加载音频，首次播放手势内先load再play', async () => {
  const h = setup(), input = { id: 'A' }; const view = h.render(input);
  assert.equal(h.calls.filter(c => c[0] === 'load').length, 0);
  assert.equal(view.state, 'ready');
  await view.play();
  assert.deepEqual(h.calls.filter(c => ['load', 'play'].includes(c[0])), [['load', input], ['play']]);
  h.unmount();
});
test('重复操作不重取同一Score，换作品后需新播放意图', async () => {
  const h = setup(), a = { id: 'A' }, b = { id: 'B' };
  const first = h.render(a); await first.toggle(); await first.toggle();
  assert.equal(h.calls.filter(c => c[0] === 'load').length, 1);
  const second = h.render(b);
  assert.equal(h.calls.filter(c => c[0] === 'load').length, 1);
  await second.play();
  assert.deepEqual(h.calls.filter(c => c[0] === 'load').map(c => c[1]), [a, b]);
  h.unmount();
});
