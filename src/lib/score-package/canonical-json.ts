export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function assertUnicode(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || next < 0xdc00 || next > 0xdfff) {
        throw new Error('JSON 含未配对的 UTF-16 高代理项');
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error('JSON 含未配对的 UTF-16 低代理项');
    }
  }
}

function canonicalize(value: unknown, ancestors: WeakSet<object>): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') {
    assertUnicode(value);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('RFC 8785 不允许非有限数字');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new Error(`RFC 8785 不支持 ${typeof value}`);
  if (ancestors.has(value)) throw new Error('RFC 8785 不允许循环引用');

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const items: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) throw new Error('RFC 8785 不允许稀疏数组');
        items.push(canonicalize(value[index], ancestors));
      }
      return `[${items.join(',')}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('RFC 8785 只接受 JSON 普通对象');
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => (
      left < right ? -1 : left > right ? 1 : 0
    ));
    const entries = keys.map((key) => {
      assertUnicode(key);
      return `${JSON.stringify(key)}:${canonicalize(record[key], ancestors)}`;
    });
    return `{${entries.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

/** RFC 8785 JSON Canonicalization Scheme；输入必须已经是合法 I-JSON 数据。 */
export function canonicalizeJson(value: JsonValue): string {
  return canonicalize(value, new WeakSet());
}

function bufferOf(input: string | Uint8Array | ArrayBuffer): ArrayBuffer {
  if (input instanceof ArrayBuffer) return input.slice(0);
  const source = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy.buffer;
}

/** 浏览器与 Node 运行时共用，不引入 node:crypto。 */
export async function sha256Hex(input: string | Uint8Array | ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bufferOf(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
