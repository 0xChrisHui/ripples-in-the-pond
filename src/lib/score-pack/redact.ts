/** 日志与 last_error 脱敏：RPC 报错会带完整请求 URL（含 API key），一律只留主机名。 */
export function redact(text: string): string {
  return text.replace(/https?:\/\/([^\s/"']+)[^\s"']*/g, (_match, host: string) => `https://${host}/<redacted>`);
}

export function safeMessage(error: unknown, max = 500): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return redact(raw).slice(0, max);
}
