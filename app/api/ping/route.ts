import { NextResponse } from "next/server";

/** GET /api/ping — 公开存活检查，不需要鉴权，不暴露内部状态 */
export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
