-- =====================================================================
-- Arena São João — Bar (produtos, estoque, caixa, vendas e despesas)
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 002).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Produtos (com estoque atual)
-- ---------------------------------------------------------------------
create table bar_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Outros',
  price numeric(10,2) not null default 0 check (price >= 0),
  cost numeric(10,2) not null default 0 check (cost >= 0),
  stock int not null default 0,          -- pode ficar negativo se vender sem ter lançado a entrada
  min_stock int not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index bar_products_name_idx on bar_products (lower(name));

-- Entradas (compras) e ajustes (contagem) de estoque
create table bar_stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references bar_products(id) on delete cascade,
  kind text not null check (kind in ('entrada', 'ajuste')),
  quantity int not null,                 -- variação: +10 entrada, -2 ajuste
  unit_cost numeric(10,2),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index bar_stock_movements_product_idx on bar_stock_movements (product_id, created_at desc);

-- ---------------------------------------------------------------------
-- Caixa: abre com o troco, fecha com a conferência do dinheiro.
-- Os totais são gravados no fechamento.
-- ---------------------------------------------------------------------
create table bar_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  opening_amount numeric(10,2) not null default 0 check (opening_amount >= 0),
  closed_at timestamptz,
  sales_count int,
  total_sales numeric(10,2),
  total_pix numeric(10,2),
  total_dinheiro numeric(10,2),
  total_cartao numeric(10,2),
  total_expenses numeric(10,2),
  expected_cash numeric(10,2),
  counted_cash numeric(10,2),
  notes text not null default ''
);

-- só pode existir um caixa aberto por vez
create unique index bar_cash_sessions_one_open on bar_cash_sessions ((true)) where closed_at is null;
create index bar_cash_sessions_opened_idx on bar_cash_sessions (opened_at desc);

-- ---------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------
create table bar_sales (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references bar_cash_sessions(id) on delete restrict,
  sold_at timestamptz not null default now(),
  payment_method payment_method not null,
  total numeric(10,2) not null default 0 check (total >= 0),
  canceled boolean not null default false,
  canceled_at timestamptz
);

create index bar_sales_session_idx on bar_sales (session_id, sold_at desc);
create index bar_sales_sold_idx on bar_sales (sold_at);

create table bar_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references bar_sales(id) on delete cascade,
  product_id uuid references bar_products(id) on delete set null,
  product_name text not null,            -- guardado para o histórico não mudar se o produto for renomeado
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  unit_cost numeric(10,2) not null default 0
);

create index bar_sale_items_sale_idx on bar_sale_items (sale_id);

-- ---------------------------------------------------------------------
-- Despesas. session_id preenchido = o dinheiro saiu da gaveta do caixa.
-- ---------------------------------------------------------------------
create table bar_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default (now() at time zone 'America/Sao_Paulo')::date,
  description text not null,
  category text not null default 'Outros',
  amount numeric(10,2) not null check (amount > 0),
  payment_method payment_method not null default 'dinheiro',
  session_id uuid references bar_cash_sessions(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index bar_expenses_date_idx on bar_expenses (expense_date);

-- =====================================================================
-- Funções (rodam com a permissão de quem chama: respeitam o RLS)
-- =====================================================================

-- Registra uma venda no caixa aberto e baixa o estoque.
-- p_items = [{"product_id": "...", "quantity": 2}, ...]. O preço vem do cadastro.
create or replace function bar_register_sale(p_method payment_method, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session uuid;
  v_sale uuid;
  v_item jsonb;
  v_qty int;
  v_product bar_products%rowtype;
  v_total numeric(10,2) := 0;
begin
  select id into v_session from bar_cash_sessions where closed_at is null for update;
  if v_session is null then
    raise exception 'CAIXA_FECHADO';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'VENDA_VAZIA';
  end if;

  insert into bar_sales (session_id, payment_method) values (v_session, p_method) returning id into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'QUANTIDADE_INVALIDA';
    end if;
    select * into v_product from bar_products where id = (v_item->>'product_id')::uuid for update;
    if not found then
      raise exception 'PRODUTO_NAO_ENCONTRADO';
    end if;
    insert into bar_sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost)
    values (v_sale, v_product.id, v_product.name, v_qty, v_product.price, v_product.cost);
    update bar_products set stock = stock - v_qty where id = v_product.id;
    v_total := v_total + v_product.price * v_qty;
  end loop;

  update bar_sales set total = v_total where id = v_sale;
  return v_sale;
end;
$$;

-- Cancela uma venda do caixa aberto e devolve os produtos ao estoque.
create or replace function bar_cancel_sale(p_sale uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale bar_sales%rowtype;
begin
  select * into v_sale from bar_sales where id = p_sale for update;
  if not found then
    raise exception 'VENDA_NAO_ENCONTRADA';
  end if;
  if v_sale.canceled then
    return;
  end if;
  if exists (select 1 from bar_cash_sessions where id = v_sale.session_id and closed_at is not null) then
    raise exception 'CAIXA_JA_FECHADO';
  end if;

  update bar_sales set canceled = true, canceled_at = now() where id = p_sale;
  update bar_products p set stock = p.stock + i.quantity
  from bar_sale_items i
  where i.sale_id = p_sale and i.product_id = p.id;
end;
$$;

-- Entrada de mercadoria. Se p_expense_method vier preenchido, lança também a despesa da compra.
create or replace function bar_stock_entry(
  p_product uuid, p_quantity int, p_unit_cost numeric, p_notes text, p_expense_method payment_method default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;
  select name into v_name from bar_products where id = p_product for update;
  if not found then
    raise exception 'PRODUTO_NAO_ENCONTRADO';
  end if;

  insert into bar_stock_movements (product_id, kind, quantity, unit_cost, notes)
  values (p_product, 'entrada', p_quantity, p_unit_cost, coalesce(p_notes, ''));

  update bar_products
  set stock = stock + p_quantity,
      cost = case when coalesce(p_unit_cost, 0) > 0 then p_unit_cost else cost end
  where id = p_product;

  if p_expense_method is not null and coalesce(p_unit_cost, 0) > 0 then
    insert into bar_expenses (description, category, amount, payment_method)
    values ('Compra: ' || v_name || ' (' || p_quantity || ' un.)', 'Compra de mercadoria', p_unit_cost * p_quantity, p_expense_method);
  end if;
end;
$$;

-- Ajuste pela contagem: informa quantos tem de verdade e o sistema registra a diferença.
create or replace function bar_stock_adjust(p_product uuid, p_counted int, p_notes text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_stock int;
begin
  select stock into v_stock from bar_products where id = p_product for update;
  if not found then
    raise exception 'PRODUTO_NAO_ENCONTRADO';
  end if;
  if p_counted is null or p_counted < 0 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;
  if p_counted = v_stock then
    return;
  end if;
  insert into bar_stock_movements (product_id, kind, quantity, notes)
  values (p_product, 'ajuste', p_counted - v_stock, coalesce(p_notes, ''));
  update bar_products set stock = p_counted where id = p_product;
end;
$$;

-- Fecha o caixa aberto: calcula e grava os totais e a conferência do dinheiro.
create or replace function bar_close_session(p_counted numeric, p_notes text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session bar_cash_sessions%rowtype;
  v_count int;
  v_total numeric(10,2);
  v_pix numeric(10,2);
  v_cash numeric(10,2);
  v_card numeric(10,2);
  v_expenses numeric(10,2);
begin
  select * into v_session from bar_cash_sessions where closed_at is null for update;
  if not found then
    raise exception 'CAIXA_FECHADO';
  end if;

  select count(*),
         coalesce(sum(total), 0),
         coalesce(sum(total) filter (where payment_method = 'pix'), 0),
         coalesce(sum(total) filter (where payment_method = 'dinheiro'), 0),
         coalesce(sum(total) filter (where payment_method = 'cartao'), 0)
  into v_count, v_total, v_pix, v_cash, v_card
  from bar_sales
  where session_id = v_session.id and not canceled;

  select coalesce(sum(amount), 0) into v_expenses from bar_expenses where session_id = v_session.id;

  update bar_cash_sessions set
    closed_at = now(),
    sales_count = v_count,
    total_sales = v_total,
    total_pix = v_pix,
    total_dinheiro = v_cash,
    total_cartao = v_card,
    total_expenses = v_expenses,
    expected_cash = v_session.opening_amount + v_cash - v_expenses,
    counted_cash = p_counted,
    notes = coalesce(p_notes, '')
  where id = v_session.id;

  return v_session.id;
end;
$$;

-- =====================================================================
-- Segurança: igual ao resto do sistema (só usuários logados)
-- =====================================================================
alter table bar_products        enable row level security;
alter table bar_stock_movements enable row level security;
alter table bar_cash_sessions   enable row level security;
alter table bar_sales           enable row level security;
alter table bar_sale_items      enable row level security;
alter table bar_expenses        enable row level security;

create policy "auth_all" on bar_products        for all to authenticated using (true) with check (true);
create policy "auth_all" on bar_stock_movements for all to authenticated using (true) with check (true);
create policy "auth_all" on bar_cash_sessions   for all to authenticated using (true) with check (true);
create policy "auth_all" on bar_sales           for all to authenticated using (true) with check (true);
create policy "auth_all" on bar_sale_items      for all to authenticated using (true) with check (true);
create policy "auth_all" on bar_expenses        for all to authenticated using (true) with check (true);

revoke all on bar_products, bar_stock_movements, bar_cash_sessions, bar_sales, bar_sale_items, bar_expenses from anon;

revoke execute on function bar_register_sale(payment_method, jsonb) from public, anon;
revoke execute on function bar_cancel_sale(uuid) from public, anon;
revoke execute on function bar_stock_entry(uuid, int, numeric, text, payment_method) from public, anon;
revoke execute on function bar_stock_adjust(uuid, int, text) from public, anon;
revoke execute on function bar_close_session(numeric, text) from public, anon;
grant execute on function bar_register_sale(payment_method, jsonb) to authenticated;
grant execute on function bar_cancel_sale(uuid) to authenticated;
grant execute on function bar_stock_entry(uuid, int, numeric, text, payment_method) to authenticated;
grant execute on function bar_stock_adjust(uuid, int, text) to authenticated;
grant execute on function bar_close_session(numeric, text) to authenticated;
