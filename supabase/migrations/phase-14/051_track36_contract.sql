-- P14-G3：第 36 首的数据与 MaterialNFT 边界。
-- 母带永久 txid 只能在权利、人耳与 2/3 网关 Gate 后另行回写；本 migration 不猜地址。

alter table public.tracks
  add column if not exists material_mintable boolean not null default true;

insert into public.tracks (
  week, title, audio_url, arweave_url, cover, island, published, material_mintable
)
values (
  36,
  '当所有的碎片都在最后组合在了一起',
  '',
  null,
  '#382828',
  'default',
  false,
  false
)
on conflict (week) do update
set title = excluded.title,
    cover = excluded.cover,
    island = excluded.island,
    material_mintable = false;

comment on column public.tracks.material_mintable is
  '仅当 MaterialNFT 已有对应永久 metadata 时为 true；第 36 首默认且当前必须为 false';
