-- =====================================================================
-- Arena São João — schema inicial
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type payment_method as enum ('pix', 'dinheiro', 'cartao');
create type student_status as enum ('ativo', 'inativo');
create type payment_status as enum ('pendente', 'pago');
create type lesson_status  as enum ('agendada', 'realizada', 'cancelada');

-- ---------------------------------------------------------------------
-- Configurações (linha única, id = 1)
-- ---------------------------------------------------------------------
create table settings (
  id smallint primary key default 1 check (id = 1),
  arena_name text not null default 'Arena São João',
  pix_key text not null default '',
  group_link text not null default '',
  tpl_billing text not null default
    E'Olá, {nome}! Tudo bem? 😊\n\nPassando para lembrar da sua mensalidade da *Arena São João* no valor de *{valor}*, com vencimento em *{vencimento}*.\n\n💠 Chave Pix: {chave_pix}\n\nSe já pagou, por favor desconsidere. Obrigado! 🏐',
  tpl_lesson_confirmation text not null default
    E'Olá, {nome}! 👋\n\nSua aula particular na *Arena São João* está confirmada:\n📅 *{data}*\n⏰ *{horario}*\n💰 {valor}\n\nTe esperamos na quadra! 🏐',
  tpl_schedule text not null default
    E'🏐 *HORÁRIOS DA SEMANA — {arena}* 🏐\n📅 {semana}\n\n{horarios}\n\nConfirme sua presença e bora treinar! 💪🔥',
  updated_at timestamptz not null default now()
);

insert into settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- Planos
-- ---------------------------------------------------------------------
create table plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_price numeric(10,2) not null check (monthly_price >= 0),
  classes_per_week smallint not null default 1 check (classes_per_week between 0 and 14),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Turmas fixas
-- ---------------------------------------------------------------------
create table class_slots (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time time,
  name text not null,
  teacher text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time is null or end_time > start_time)
);

-- ---------------------------------------------------------------------
-- Alunos
-- ---------------------------------------------------------------------
create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text check (phone ~ '^55[0-9]{10,11}$'),
  plan_id uuid references plans(id) on delete set null,
  payment_method payment_method not null default 'pix',
  due_day smallint not null default 10 check (due_day between 1 and 31),
  status student_status not null default 'ativo',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index students_name_idx on students (lower(name));

-- ---------------------------------------------------------------------
-- Mensalidades
-- ---------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  competence date not null check (extract(day from competence) = 1), -- 1º dia do mês
  amount numeric(10,2) not null check (amount >= 0),
  due_date date not null,
  status payment_status not null default 'pendente',
  paid_at date,
  payment_method payment_method,
  created_at timestamptz not null default now(),
  unique (student_id, competence)
);

create index payments_due_idx on payments (due_date);

-- View com o status "atrasado" calculado (data de hoje em São Paulo).
-- security_invoker = a view respeita o RLS de quem consulta.
create view payments_view with (security_invoker = true) as
select
  p.*,
  case
    when p.status = 'pago' then 'pago'
    when p.due_date < (now() at time zone 'America/Sao_Paulo')::date then 'atrasado'
    else 'pendente'
  end as computed_status,
  s.name  as student_name,
  s.phone as student_phone
from payments p
join students s on s.id = p.student_id;

-- Gera as mensalidades do mês para todos os alunos ativos com plano.
-- Não duplica (unique student_id + competence). Retorna quantas criou.
create or replace function generate_monthly_payments(p_year int, p_month int)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_comp date := make_date(p_year, p_month, 1);
  v_last int  := extract(day from (v_comp + interval '1 month' - interval '1 day'))::int;
  v_count int;
begin
  insert into payments (student_id, competence, amount, due_date, payment_method)
  select s.id, v_comp, pl.monthly_price,
         make_date(p_year, p_month, least(s.due_day, v_last)),
         s.payment_method
  from students s
  join plans pl on pl.id = s.plan_id
  where s.status = 'ativo'
  on conflict (student_id, competence) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Aulas avulsas
-- ---------------------------------------------------------------------
create table private_lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  guest_name text,
  guest_phone text check (guest_phone ~ '^55[0-9]{10,11}$'),
  lesson_date date not null,
  start_time time not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  status lesson_status not null default 'agendada',
  paid boolean not null default false,
  payment_method payment_method,
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (student_id is not null or coalesce(guest_name, '') <> '')
);

create index private_lessons_date_idx on private_lessons (lesson_date, start_time);

-- ---------------------------------------------------------------------
-- Aluguel da quadra
-- ---------------------------------------------------------------------
create table court_bookings (
  id uuid primary key default gen_random_uuid(),
  responsible_name text not null,
  phone text check (phone ~ '^55[0-9]{10,11}$'),
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  paid boolean not null default false,
  payment_method payment_method,
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  -- impede duas reservas com horário sobreposto no mesmo dia
  constraint court_bookings_no_overlap exclude using gist (
    tsrange(booking_date + start_time, booking_date + end_time, '[)') with &&
  )
);

create index court_bookings_date_idx on court_bookings (booking_date, start_time);

-- ---------------------------------------------------------------------
-- Eventos
-- ---------------------------------------------------------------------
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  start_time time,
  location text not null default '',
  capacity int check (capacity is null or capacity > 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table event_lots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  sort_order int not null default 0
);

create table event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  lot_id uuid references event_lots(id) on delete set null,
  name text not null,
  phone text check (phone ~ '^55[0-9]{10,11}$'),
  payment_method payment_method not null default 'pix',
  amount_paid numeric(10,2) not null default 0 check (amount_paid >= 0),
  paid_at date not null default (now() at time zone 'America/Sao_Paulo')::date,
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create index event_participants_event_idx on event_participants (event_id);

-- =====================================================================
-- Segurança: RLS em TODAS as tabelas, acesso só para usuários logados
-- =====================================================================
alter table settings           enable row level security;
alter table plans              enable row level security;
alter table class_slots        enable row level security;
alter table students           enable row level security;
alter table payments           enable row level security;
alter table private_lessons    enable row level security;
alter table court_bookings     enable row level security;
alter table events             enable row level security;
alter table event_lots         enable row level security;
alter table event_participants enable row level security;

create policy "auth_all" on settings           for all to authenticated using (true) with check (true);
create policy "auth_all" on plans              for all to authenticated using (true) with check (true);
create policy "auth_all" on class_slots        for all to authenticated using (true) with check (true);
create policy "auth_all" on students           for all to authenticated using (true) with check (true);
create policy "auth_all" on payments           for all to authenticated using (true) with check (true);
create policy "auth_all" on private_lessons    for all to authenticated using (true) with check (true);
create policy "auth_all" on court_bookings     for all to authenticated using (true) with check (true);
create policy "auth_all" on events             for all to authenticated using (true) with check (true);
create policy "auth_all" on event_lots         for all to authenticated using (true) with check (true);
create policy "auth_all" on event_participants for all to authenticated using (true) with check (true);

-- Camada extra: o papel anon não tem nenhum privilégio nas tabelas/views/funções
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on function generate_monthly_payments(int, int) from public, anon;
grant  execute on function generate_monthly_payments(int, int) to authenticated;
