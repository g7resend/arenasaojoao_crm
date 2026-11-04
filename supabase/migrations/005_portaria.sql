-- =====================================================================
-- Arena São João — login de portaria
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 004).
--
-- Até aqui, todo usuário logado podia tudo. A partir daqui:
--   * administrador = quem está em app_admins (os logins que já existem);
--   * qualquer outro login não acessa nenhuma tabela. Só consegue usar as
--     funções gate_*, e só nos eventos liberados para ele.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Administradores. Todo login existente hoje vira administrador.
-- Login novo não entra aqui: sem cadastro, sem acesso.
-- ---------------------------------------------------------------------
create table app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into app_admins (user_id) select id from auth.users;

alter table app_admins enable row level security;
revoke all on app_admins from anon, authenticated;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()));
$$;

revoke execute on function is_admin() from public, anon;
grant  execute on function is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- Troca "todo logado" por "só administrador" em todas as tabelas
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select tablename from pg_policies where schemaname = 'public' and policyname = 'auth_all' loop
    execute format('drop policy "auth_all" on public.%I', t);
    execute format(
      'create policy "admin_all" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t
    );
  end loop;
end;
$$;

-- Imagens dos eventos: ver continua público; enviar, trocar e apagar é só do administrador
drop policy "eventos_auth_select" on storage.objects;
drop policy "eventos_auth_insert" on storage.objects;
drop policy "eventos_auth_update" on storage.objects;
drop policy "eventos_auth_delete" on storage.objects;

create policy "eventos_admin_select" on storage.objects
  for select to authenticated using (bucket_id = 'eventos' and (select public.is_admin()));

create policy "eventos_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'eventos' and (select public.is_admin()));

create policy "eventos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'eventos' and (select public.is_admin()))
  with check (bucket_id = 'eventos' and (select public.is_admin()));

create policy "eventos_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'eventos' and (select public.is_admin()));

-- ---------------------------------------------------------------------
-- Quais eventos cada login de portaria pode abrir
-- ---------------------------------------------------------------------
create table event_gate_access (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_gate_access_user_idx on event_gate_access (user_id);

alter table event_gate_access enable row level security;
create policy "admin_all" on event_gate_access for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on event_gate_access from anon;

-- Administrador libera um evento para um login, pelo e-mail
create or replace function gate_grant(p_event uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  select id, email into v_user, v_email from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'usuario_nao_encontrado';
  end if;
  if exists (select 1 from public.app_admins where user_id = v_user) then
    raise exception 'usuario_administrador';
  end if;

  insert into public.event_gate_access (event_id, user_id, email)
  values (p_event, v_user, v_email)
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- O que a portaria enxerga: só evento, nome e se já entrou.
-- Telefone, valor pago e forma de pagamento não saem daqui.
-- ---------------------------------------------------------------------
create or replace function gate_events()
returns table (id uuid, name text, event_date date, start_time time, location text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.name, e.event_date, e.start_time, e.location
  from public.events e
  join public.event_gate_access a on a.event_id = e.id
  where a.user_id = (select auth.uid())
  order by e.event_date, e.start_time;
$$;

create or replace function gate_participants(p_event uuid)
returns table (id uuid, name text, checked_in boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.event_gate_access a where a.event_id = p_event and a.user_id = (select auth.uid())
  ) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  return query
    select p.id, p.name, p.checked_in
    from public.event_participants p
    where p.event_id = p_event
    order by p.name;
end;
$$;

create or replace function gate_set_check_in(p_participant uuid, p_checked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_participants p
  set checked_in = p_checked,
      checked_in_at = case when p_checked then now() end
  where p.id = p_participant
    and exists (
      select 1 from public.event_gate_access a where a.event_id = p.event_id and a.user_id = (select auth.uid())
    );

  if not found then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function gate_grant(uuid, text) from public, anon;
revoke execute on function gate_events() from public, anon;
revoke execute on function gate_participants(uuid) from public, anon;
revoke execute on function gate_set_check_in(uuid, boolean) from public, anon;
grant execute on function gate_grant(uuid, text) to authenticated;
grant execute on function gate_events() to authenticated;
grant execute on function gate_participants(uuid) to authenticated;
grant execute on function gate_set_check_in(uuid, boolean) to authenticated;

-- Conferência: a primeira coluna tem que ser 1 ou mais e a segunda tem que ser 0
select
  (select count(*) from app_admins) as administradores,
  (select count(*) from pg_policies where schemaname = 'public' and policyname = 'auth_all') as regras_antigas_restantes;
