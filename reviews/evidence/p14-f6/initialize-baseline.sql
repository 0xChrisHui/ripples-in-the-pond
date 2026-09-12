begin;

do $$
declare
  v_score_contract constant text := '0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa';
begin
  if exists (
    select 1 from public.system_kv
    where key in (
      'p14:activation:10:' || v_score_contract,
      'p14:cursor:10:' || v_score_contract
    )
  ) then
    raise exception 'P14 主网 activation/cursor 已存在，拒绝覆盖';
  end if;
  if exists (select 1 from public.wallet_recipe_queue where chain_id = 10) then
    raise exception 'P14 主网队列非空，拒绝重建基线';
  end if;
  if (
    select count(*) from public.chain_events
    where lower(contract) = v_score_contract and event_name = 'Transfer'
      and lower(from_addr) = '0x0000000000000000000000000000000000000000'
      and block_number <= 156738598
  ) <> 2 then
    raise exception 'cutoff 前 Score mint 集合不再是已对账的 2 条';
  end if;
end;
$$;

insert into public.system_kv (key, value, updated_at) values
  ('p14:activation:10:0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa', '156738598', now()),
  ('p14:cursor:10:0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa', '155933186:-1', now());

select * from public.register_wallet_recipe_origin(
  10,
  '0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa',
  '0x19da4b170dF5CcA47414b04f04a24f67E2E6bA54',
  '30c75936-515c-411e-a033-0d64357b19a6',
  1,
  '0x1d2de0a47e73114e87ecb7d81b5b49e61edb5f7b4a4c2871317811b53f182f4a',
  71,
  155937041,
  null,
  null,
  '155933186:-1'
);

select * from public.register_wallet_recipe_origin(
  10,
  '0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa',
  '0xFD869d82A64e51cb488631fe25A46f9DBe417f20',
  null,
  2,
  '0xdbc760988b59faff3636e70f51614d59de599eab69b87378680a143b880050f0',
  80,
  156213815,
  null,
  null,
  '155937041:71'
);

do $$
begin
  if (select count(*) from public.wallet_recipe_queue where chain_id = 10) <> 2
    or (select count(*) from public.wallet_recipe_queue
      where chain_id = 10 and eligibility = 'excluded_prelaunch'
        and status = 'excluded_prelaunch') <> 2
    or (select count(*) from public.wallet_recipe_queue
      where chain_id = 10 and eligibility = 'eligible') <> 0 then
    raise exception 'P14 历史排除集合写入后不一致';
  end if;
  if (select value from public.system_kv
      where key = 'p14:activation:10:0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa') <> '156738598'
    or (select value from public.system_kv
      where key = 'p14:cursor:10:0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa') <> '156213815:80' then
    raise exception 'P14 activation/cursor 写入后不一致';
  end if;
end;
$$;

commit;

select eligibility, status, count(*) as rows
from public.wallet_recipe_queue
where chain_id = 10
group by eligibility, status
order by eligibility, status;
