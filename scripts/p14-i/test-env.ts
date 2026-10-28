// 单测专用合成环境：必须在被测模块之前 import，让模块初始化不读取 .env.local、不连真实服务。
// 只填缺省值；所有地址指向 .invalid，测试中任何意外的网络请求都会立即失败。
const synthetic: Record<string, string> = {
  NEXT_PUBLIC_CHAIN_ID: '11155420',
  NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
  SERVER_SUPABASE_URL: 'https://supabase.invalid',
  SERVER_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
  ALCHEMY_RPC_URL: 'https://rpc.invalid',
  NEXT_PUBLIC_PRIVY_APP_ID: 'synthetic-privy-app',
  PRIVY_APP_SECRET: 'synthetic-privy-secret',
};
for (const [key, value] of Object.entries(synthetic)) process.env[key] ??= value;
