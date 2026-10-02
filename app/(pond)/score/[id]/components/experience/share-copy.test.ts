import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isScoreAuthor, scoreShareCopy, scoreShareIntent, scoreShareUrl } from './share-copy';

test('作者/旁听者使用默认B文案，保留主网规范链接', () => {
  const creator = `0x${'12'.repeat(20)}`;
  assert.equal(isScoreAuthor(true, creator, creator.toUpperCase().replace('0X', '0x')), true);
  assert.equal(isScoreAuthor(false, creator, creator), false);
  assert.equal(isScoreAuthor(true, `0x${'34'.repeat(20)}`, creator), false);
  assert.ok(scoreShareCopy('x', '原曲 & 1', true).includes('我今天留在水塘里的声音'));
  assert.ok(scoreShareCopy('weibo', '原曲 & 1', false).includes('发现一段有意思的即兴演奏'));
  const canonical = `/score/1/${creator}/1`;
  const url = scoreShareUrl('https://pond-ripple.xyz', canonical)!;
  const intent = new URL(scoreShareIntent('x', scoreShareCopy('x', '原曲 & 1', false), url));
  assert.equal(intent.searchParams.get('url'), `https://pond-ripple.xyz${canonical}`);
  assert.ok(intent.searchParams.get('text')?.includes('《原曲 & 1》'));
  assert.equal(scoreShareUrl('https://pond-ripple.xyz', '//example.org'), null);
  assert.equal(scoreShareUrl('https://pond-ripple.xyz', '/score/1?injected=1'), null);
});
