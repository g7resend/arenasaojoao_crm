-- =====================================================================
-- Arena São João — comissários e cardápio dos eventos
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 003).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Comissários: quem vende ingresso. Cada evento tem a sua lista.
-- Excluir um comissário não apaga os pagantes: eles ficam "sem comissário".
-- ---------------------------------------------------------------------
create table event_sellers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index event_sellers_event_idx on event_sellers (event_id);

alter table event_participants
  add column seller_id uuid references event_sellers(id) on delete set null;

create index event_participants_seller_idx on event_participants (seller_id);

-- ---------------------------------------------------------------------
-- Cardápio do evento (sai no PDF A3 na ordem de sort_order)
-- ---------------------------------------------------------------------
create table event_menu_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0 check (price >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index event_menu_items_event_idx on event_menu_items (event_id, sort_order);

-- ---------------------------------------------------------------------
-- Segurança: só usuários logados
-- ---------------------------------------------------------------------
alter table event_sellers    enable row level security;
alter table event_menu_items enable row level security;

create policy "auth_all" on event_sellers    for all to authenticated using (true) with check (true);
create policy "auth_all" on event_menu_items for all to authenticated using (true) with check (true);

revoke all on event_sellers    from anon;
revoke all on event_menu_items from anon;
