import assert from 'node:assert/strict';
import { isOrderInFlight, mintPinnedTrackId, setMintActivity } from '../../src/components/music-catalog/claim/mint-status-cache';

const order = (status: string) => ({ status } as Parameters<typeof isOrderInFlight>[0]);

// 订单状态：只有"已发出、待确认"算进行中
for (const status of ['sending', 'unknown', 'submitted', 'confirming']) assert.equal(isOrderInFlight(order(status)), true, status);
for (const status of ['prepared', 'authorized', 'success', 'reverted', 'cancelled']) assert.equal(isOrderInFlight(order(status)), false, status);
assert.equal(isOrderInFlight(null), false);

// 没有活动 → 不钉住
assert.equal(mintPinnedTrackId(1000), null);
// 进行中 → 钉住，且不随时间过期
setMintActivity('t5', true);
assert.equal(mintPinnedTrackId(Date.now() + 10 * 60 * 1000), 't5');
// 结束 → 仍保留一小段时间让用户看到结果，过期后释放
setMintActivity('t5', false);
assert.equal(mintPinnedTrackId(Date.now() + 2000), 't5', '结束后 2 秒内仍钉住');
assert.equal(mintPinnedTrackId(Date.now() + 9000), null, '超过保留时长后释放');
// 同一曲目重复"结束"不会刷新保留时间；重新开始则重新钉住
setMintActivity('t5', true);
assert.equal(mintPinnedTrackId(), 't5');
setMintActivity('t5', false);
// 多首：进行中的优先于刚结束的
setMintActivity('a', true);
setMintActivity('b', true); setMintActivity('b', false);
assert.equal(mintPinnedTrackId(), 'a');
setMintActivity('a', false);
console.log('mint-activity ✅');
