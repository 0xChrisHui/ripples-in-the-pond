import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveClientIp } from '../../src/lib/rate-limit/client-ip';

const secret = 'a'.repeat(64);
const previous = 'b'.repeat(64);
const env = { EDGE_PROXY_SECRET: secret, EDGE_PROXY_SECRET_PREVIOUS: previous };
const headers = (ip: string, key = secret) => new Headers({
  'x-forwarded-for': '203.0.113.8, 10.0.0.1',
  'x-pond-client-ip': ip, 'x-pond-edge-secret': key,
});

test('未配置密钥时保留原始 XFF 与 x-real-ip 回退', () => {
  assert.deepEqual(resolveClientIp(headers('192.0.2.1'), {}), { ip: '203.0.113.8', source: 'direct' });
  assert.equal(resolveClientIp(new Headers({ 'x-real-ip': '192.0.2.2' }), {}).ip, '192.0.2.2');
  assert.equal(resolveClientIp(new Headers(), {}).ip, 'unknown');
});

test('新旧密钥都能分离可信客户端 IP，不相信未签名的新头', () => {
  for (const key of [secret, previous]) {
    assert.deepEqual(resolveClientIp(headers('192.0.2.1', key), env), { ip: '192.0.2.1', source: 'edge' });
  }
  for (const key of ['', 'wrong', 'a'.repeat(63), secret + ', ' + secret]) {
    assert.equal(resolveClientIp(headers('192.0.2.1', key), env).source, 'direct');
  }
  assert.notEqual(resolveClientIp(headers('192.0.2.1'), env).ip,
    resolveClientIp(headers('192.0.2.2'), env).ip);
});

test('拒绝多个 IP、端口、缩写 IPv4 及非法地址', () => {
  for (const ip of ['192.0.2.1,192.0.2.2', '256.1.1.1', '1.2.3', '127.1', '01.2.3.4',
    '192.0.2.1:80', '[::1]:80', '::1%eth0', 'x', '', 'http://127.0.0.1']) {
    assert.equal(resolveClientIp(headers(ip), env).source, 'direct', ip);
  }
});

test('IPv6 规范化后按 /64 聚合，下一网段分离', () => {
  const a = resolveClientIp(headers('2001:0DB8:0001:0002::1'), env);
  const b = resolveClientIp(headers('2001:db8:1:2::abcd'), env);
  const c = resolveClientIp(headers('2001:db8:1:3::1'), env);
  assert.equal(a.source, 'edge');
  assert.equal(a.ip, '2001:db8:1:2::/64');
  assert.equal(a.ip, b.ip);
  assert.notEqual(a.ip, c.ip);
  assert.equal(resolveClientIp(headers('::ffff:192.0.2.1'), env).source, 'edge');
});
