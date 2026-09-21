import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type BlobWriter = {
  put(localPath: string, pathname: `media/${string}`, mime: 'audio/mpeg'): Promise<void>;
};

export function buildPutArguments(
  prefix: string[], auth: string[], localPath: string,
  pathname: `media/${string}`, mime: 'audio/mpeg',
): string[] {
  // Vercel CLI 的布尔参数出现即为 true；false 必须依赖官方默认值，不能传成下一个 argv。
  return [...prefix, 'blob', ...auth, 'put', localPath,
    '--pathname', pathname, '--access', 'public', '--content-type', mime, '--non-interactive'];
}

export function createVercelBlobWriter(): BlobWriter {
  return {
    async put(localPath, pathname, mime) {
      const windowsCli = process.env.APPDATA
        ? join(process.env.APPDATA, 'npm/node_modules/vercel/dist/vc.js') : '';
      const executable = process.platform === 'win32' ? process.execPath : 'vercel';
      const prefix = process.platform === 'win32' ? [windowsCli] : [];
      const oidc = process.env.VERCEL_OIDC_TOKEN;
      const store = process.env.BLOB_STORE_ID;
      const rwToken = process.env.BLOB_READ_WRITE_TOKEN;
      const auth = oidc && store
        ? ['--oidc-token', oidc, '--store-id', store]
        : rwToken ? ['--rw-token', rwToken] : [];
      try {
        await execFileAsync(executable, buildPutArguments(
          prefix, auth, localPath, pathname, mime,
        ), { windowsHide: true, maxBuffer: 1024 * 1024, timeout: 120_000 });
      } catch (error) {
        const stderr = typeof error === 'object' && error && 'stderr' in error
          ? String(error.stderr) : 'unknown CLI failure';
        let redacted = stderr;
        for (const secret of [oidc, rwToken]) {
          if (secret) redacted = redacted.replaceAll(secret, '[redacted]');
        }
        throw new Error(`Vercel Blob 上传失败：${redacted.slice(0, 1000)}`);
      }
    },
  };
}

export function normalizeMirrorBase(value: string | undefined): string {
  if (!value) throw new Error('缺少 NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.search || url.hash) throw new Error('镜像地址必须是无参数的 HTTPS URL');
  const pathname = url.pathname.replace(/\/+$/, '');
  if (pathname !== '/media') throw new Error('镜像地址路径必须精确为 /media');
  return `${url.origin}${pathname}`;
}
