import assert from 'node:assert/strict';
import test from 'node:test';
import { describeMaterialError } from '../../src/features/material-catalog/mint/friendly-error';

test('钱包拒绝显示为中性取消，不暴露 calldata', () => {
  const rejected = Object.assign(new Error('User rejected the request. data: 0x6b1140a3'), { code: 4001 });
  const notice = describeMaterialError(rejected);
  assert.equal(notice.tone, 'info'); assert.match(notice.title, /取消/); assert.equal(notice.detail, undefined);
});
test('余额不足、网络失败分别给出可执行提示', () => {
  assert.match(describeMaterialError(new Error('ETH不足以支付保守Gas估算')).title, /余额不足/);
  assert.equal(describeMaterialError(new Error('HTTP request failed. Failed to fetch')).tone, 'warn');
});
test('可读中文短句原样显示，其余走兜底并折叠技术详情', () => {
  assert.equal(describeMaterialError(new Error('已有交易等待核对，不能再次发送')).title, '已有交易等待核对，不能再次发送');
  const unknown = describeMaterialError(new Error('boom 0xdeadbeef'));
  assert.equal(unknown.title, '领取暂时没有完成'); assert.match(unknown.detail ?? '', /boom/);
});
