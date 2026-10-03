-- 仅用于独立本机PostgreSQL验证；不连接Supabase，不包含真实账号或钱包密钥。
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon,authenticated,service_role;
insert into public.users(id,evm_address,privy_user_id) values
 ('10000000-0000-4000-8000-000000000001','0x1111111111111111111111111111111111111111','p17-local-owner'),
 ('10000000-0000-4000-8000-000000000002','0x2222222222222222222222222222222222222222','p17-local-other');
