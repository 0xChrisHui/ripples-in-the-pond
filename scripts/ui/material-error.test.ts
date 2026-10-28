import assert from 'node:assert/strict';
import test from 'node:test';
import { describeMaterialError, localMaterialNotice, renderMaterialNotice } from '../../src/features/material-catalog/mint/friendly-error';
import zhMessages from '../../src/i18n/messages/zh.json';
import enMessages from '../../src/i18n/messages/en.json';

// 与 MaterialNoticeView 同形：键在 material 命名空间下，直接取词典，避免在 node 测试里挂 React provider
function translator(locale: 'zh' | 'en') {
  const root = (locale === 'zh' ? zhMessages : enMessages).material;
  return (key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], root) as string;
}
const render = (notice: ReturnType<typeof describeMaterialError>, locale: 'zh' | 'en') =>
  renderMaterialNotice(notice, locale, translator(locale));

test('钱包拒绝显示为中性取消，不暴露 calldata', () => {
  const rejected = Object.assign(new Error('User rejected the request. data: 0x6b1140a3'), { code: 4001 });
  const notice = render(describeMaterialError(rejected), 'zh');
  assert.equal(notice.tone, 'info'); assert.match(notice.title, /取消/); assert.equal(notice.detail, undefined);
});
test('余额不足、网络失败分别给出可执行提示', () => {
  assert.match(render(describeMaterialError(new Error('ETH不足以支付保守Gas估算')), 'zh').title, /余额不足/);
  assert.equal(describeMaterialError(new Error('HTTP request failed. Failed to fetch')).tone, 'warn');
});
test('可读中文短句原样显示，其余走兜底并折叠技术详情', () => {
  assert.equal(render(describeMaterialError(new Error('已有交易等待核对，不能再次发送')), 'zh').title, '已有交易等待核对，不能再次发送');
  const unknown = render(describeMaterialError(new Error('boom 0xdeadbeef')), 'zh');
  assert.equal(unknown.title, '铸造暂时没有完成'); assert.match(unknown.detail ?? '', /boom/);
});
test('英文模式：中文原文既不作标题也不进技术详情（P19 F5）', () => {
  const notice = render(describeMaterialError(new Error('已有交易等待核对，不能再次发送')), 'en');
  assert.equal(notice.title, enMessages.material.notice.fallback); assert.doesNotMatch(notice.title, /[一-鿿]/);
  assert.equal(notice.detail, undefined);
  const mixed = render(describeMaterialError(new Error('请先登录 0xdeadbeef1234')), 'en');
  assert.equal(mixed.detail, undefined);
  assert.equal(render(describeMaterialError(Object.assign(new Error('x'), { code: 4001 })), 'en').title, enMessages.material.notice.rejectedTitle);
});
test('英文模式保留英文技术详情', () => {
  assert.match(render(describeMaterialError(new Error('boom 0xdeadbeef')), 'en').detail ?? '', /boom/);
});
test('同一条提示切换语言后重新取词（提示只存键）', () => {
  const stored = describeMaterialError(new Error('x'), 'order.unavailable');
  assert.equal(render(stored, 'zh').title, zhMessages.material.order.unavailable);
  assert.equal(render(stored, 'en').title, enMessages.material.order.unavailable);
  const local = localMaterialNotice('eth.walletNotReady');
  assert.equal(render(local, 'en').title, enMessages.material.eth.walletNotReady);
  assert.equal(render(local, 'zh').hint, zhMessages.material.notice.reviewHint);
});
