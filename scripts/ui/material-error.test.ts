import assert from 'node:assert/strict';
import test from 'node:test';
import { describeMaterialError, type MaterialErrorCopy } from '../../src/features/material-catalog/mint/friendly-error';
import zhMessages from '../../src/i18n/messages/zh.json';
import enMessages from '../../src/i18n/messages/en.json';

// 与 useMaterialErrorCopy 同形：直接取词典，避免在 node 测试里挂 React provider
function copyFor(locale: 'zh' | 'en'): MaterialErrorCopy {
  const n = (locale === 'zh' ? zhMessages : enMessages).material.notice;
  return { locale, fallback: n.fallback, reviewHint: n.reviewHint,
    rejected: { title: n.rejectedTitle, hint: n.rejectedHint }, funds: { title: n.fundsTitle, hint: n.fundsHint },
    network: { title: n.networkTitle, hint: n.networkHint } };
}
const zh = copyFor('zh');
const en = copyFor('en');

test('钱包拒绝显示为中性取消，不暴露 calldata', () => {
  const rejected = Object.assign(new Error('User rejected the request. data: 0x6b1140a3'), { code: 4001 });
  const notice = describeMaterialError(rejected, zh);
  assert.equal(notice.tone, 'info'); assert.match(notice.title, /取消/); assert.equal(notice.detail, undefined);
});
test('余额不足、网络失败分别给出可执行提示', () => {
  assert.match(describeMaterialError(new Error('ETH不足以支付保守Gas估算'), zh).title, /余额不足/);
  assert.equal(describeMaterialError(new Error('HTTP request failed. Failed to fetch'), zh).tone, 'warn');
});
test('可读中文短句原样显示，其余走兜底并折叠技术详情', () => {
  assert.equal(describeMaterialError(new Error('已有交易等待核对，不能再次发送'), zh).title, '已有交易等待核对，不能再次发送');
  const unknown = describeMaterialError(new Error('boom 0xdeadbeef'), zh);
  assert.equal(unknown.title, '铸造暂时没有完成'); assert.match(unknown.detail ?? '', /boom/);
});
test('英文模式：中文原文不作标题，改用英文兜底并放进技术详情（P19 F5）', () => {
  const notice = describeMaterialError(new Error('已有交易等待核对，不能再次发送'), en);
  assert.equal(notice.title, en.fallback); assert.doesNotMatch(notice.title, /[一-鿿]/);
  assert.match(notice.detail ?? '', /已有交易/);
  assert.equal(describeMaterialError(Object.assign(new Error('x'), { code: 4001 }), en).title, en.rejected.title);
});
