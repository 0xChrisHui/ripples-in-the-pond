import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pond-p25-nginx-'));
  mkdirSync(join(root, 'temp'));
  const calls = [];
  const audio = Buffer.alloc(2 * 1024 * 1024 + 719);
  for (let i = 0; i < audio.length; i++) audio[i] = i % 251;
  const origin = http.createServer((req, res) => {
    calls.push({ url: req.url, headers: req.headers });
    if (req.url.includes('/api/')) {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(req.headers));
    }
    if (req.url.includes('absent')) { res.writeHead(404); return res.end('absent'); }
    if (req.url.includes('failure')) { res.writeHead(503); return res.end('failure'); }
    if (req.url.includes('cookie')) res.setHeader('Set-Cookie', 'session=private');
    res.setHeader('Cache-Control', 'public, max-age=0');
    if (req.url.startsWith('/_next/static/')) return res.end('hashed-static');
    if (req.url.startsWith('/tracks/No.') || req.url.startsWith('/media/')) {
      const match = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
      const start = match ? Number(match[1]) : 0;
      const end = match ? Math.min(Number(match[2] || audio.length - 1), audio.length - 1) : audio.length - 1;
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('content-type', 'audio/mpeg');
      if (start >= audio.length) {
        res.setHeader('Content-Range', `bytes */${audio.length}`);
        res.writeHead(416); return res.end();
      }
      if (match) {
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${audio.length}`);
      }
      res.setHeader('Content-Length', end - start + 1);
      return res.end(audio.subarray(start, end + 1));
    }
    res.setHeader('content-type', 'text/html'); res.end('<main>dynamic</main>');
  });
  await new Promise(resolveListen => origin.listen(0, '127.0.0.1', resolveListen));
  const originPort = origin.address().port;
  const reserve = http.createServer();
  await new Promise(resolveListen => reserve.listen(0, '127.0.0.1', resolveListen));
  const port = reserve.address().port;
  await new Promise(resolveClose => reserve.close(resolveClose));
  const secretFile = join(root, 'secret.txt');
  writeFileSync(secretFile, 'a'.repeat(64));
  const python = process.env.POND_PYTHON ?? 'python';
  const rendered = spawnSync(python, ['ops/hk-edge/render.py', '--upstream', `127.0.0.1:${originPort}`,
    '--output', root, '--secret-file', secretFile, '--cache', join(root, 'cache'), '--state', root,
    '--ca-bundle', process.env.POND_CA_BUNDLE ?? (process.platform === 'win32'
      ? 'D:/InstalledApps/ServBay/ssl/cacert.pem' : '/etc/ssl/certs/ca-certificates.crt'),
    '--certificate', join(root, 'cert.pem'), '--certificate-key', join(root, 'key.pem')], { encoding: 'utf8' });
  if (rendered.status !== 0) { origin.close(); throw Error(rendered.stderr || rendered.stdout); }
  const configPath = join(root, 'nginx.conf');
  // 仅本地合同演练将同一模板的 TLS 监听换成回环 HTTP；生产模板仍强制验证 TLS。
  let config = readFileSync(configPath, 'utf8').replace(/listen 80([^;]*);/g, 'listen 127.0.0.1:0$1;')
    .replace(/listen 443 ssl/g, `listen 127.0.0.1:${port}`)
    .replace(/^\s*ssl_certificate(?:_key)? .*;$/gm, '')
    .replace(/https:\/\/\$pond_vercel_origin/g, 'http://$pond_vercel_origin');
  // 80 端口两台虚拟主机必须共用相同监听，故完全移除 HTTP 重定向组。
  config = config.replace(/\s*server \{\s*listen 127\.0\.0\.1:0[\s\S]*?\n    \}/g, '');
  writeFileSync(configPath, config);
  const nginx = process.env.POND_NGINX_BIN ?? (process.platform === 'win32'
    ? 'D:/InstalledApps/ServBay/packages/nginx/nginx.exe' : 'nginx');
  const args = ['-p', root.replaceAll('\\', '/') + '/', '-c', configPath.replaceAll('\\', '/'), '-e', 'error.log'];
  const checked = spawnSync(nginx, [...args, '-t'], { encoding: 'utf8' });
  if (checked.status !== 0) { origin.close(); throw Error(checked.stderr); }
  // Windows 不走其不可靠的 master 事件握手；仅本地测试单进程，生产模板不变。
  const runtimeArgs = process.platform === 'win32' ? [...args, '-g', 'master_process off; daemon off;'] : args;
  const child = spawn(nginx, runtimeArgs, { cwd: root, windowsHide: true, stdio: 'ignore' });
  // Node fetch 会覆盖 Host；这里直接用 HTTP 客户端保留虚拟主机合同。
  const request = (path, options = {}) => new Promise((resolveResponse, reject) => {
    const outgoing = http.request({ hostname: '127.0.0.1', port, path, ...options,
      headers: { Host: 'pond-ripple.xyz', ...options.headers } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolveResponse({ status: response.statusCode,
        headers: new Headers(Object.entries(response.headers).flatMap(([key, value]) =>
          (Array.isArray(value) ? value : [value]).filter(item => item !== undefined).map(item => [key, item]))),
        body: Buffer.concat(chunks) }));
    });
    outgoing.setTimeout(10_000, () => outgoing.destroy(Error('本地 HTTP 超时')));
    outgoing.on('error', reject); outgoing.end();
  });
  for (let i = 0; i < 50; i++) {
    try { await request('/_edge/health'); break; }
    catch { await new Promise(wait => setTimeout(wait, 100)); }
  }
  return { root, audio, calls, request, stop: async () => {
    if (process.platform !== 'win32') spawnSync(nginx, [...args, '-s', 'quit'], { encoding: 'utf8' });
    await new Promise(wait => setTimeout(wait, 200));
    child.kill(); origin.closeAllConnections(); await new Promise(done => origin.close(done));
    console.log('nginx 合同证据目录：' + resolve(root));
  } };
}
