import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin 客户端 — 用 service_role_key，绕过 RLS
 * 只能在后端（API Route / cron）使用，绝不能被前端 import
 */
const serverUrl = process.env.SERVER_SUPABASE_URL?.trim() || undefined;
const serverKey = process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
if (Boolean(serverUrl) !== Boolean(serverKey)) {
  throw new Error('SERVER_SUPABASE_URL 与 SERVER_SUPABASE_SERVICE_ROLE_KEY 必须成对配置');
}

export const supabaseAdmin = createClient(
  serverUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serverKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
