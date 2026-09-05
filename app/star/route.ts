import { type NextRequest, NextResponse } from 'next/server';

/** 历史 `/star` 与 `/v1` 内容重复；以 HTTP 308 永久归并到受维护的兼容入口。 */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/v1', request.url), 308);
}
