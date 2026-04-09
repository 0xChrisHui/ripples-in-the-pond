import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin 客户端 — 用 service_role_key，绕过 RLS
 * 只能在后端（API Route / cron）使用，绝不能被前端 import
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
