-- =====================================================================
-- Arena São João — venda na hora pela portaria
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 006).
--
-- A portaria continua sem acesso às tabelas. Ela só registra a venda por
-- esta função, e só nos eventos liberados para ela. Valor e telefone
-- continuam sem aparecer na tela da portaria.
-- =====================================================================

-- Separa o que foi vendido na portaria, para o administrador conferir o caixa
alter table event_participants
  add column if not exists sold_at_gate boolean not null default false;

-- Quem compra na portaria já está entrando: o nome nasce com a entrada marcada
create or replace function gate_register_sale(
  p_event uuid,
  p_name text,
  p_phone text,
  p_amount numeric,
  p_method public.payment_method
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if not exists (
    select 1 from public.event_gate_access a where a.event_id = p_event and a.user_id = (select auth.uid())
  ) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'nome_obrigatorio';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'valor_invalido';
  end if;
  if p_method is null then
    raise exception 'forma_obrigatoria';
  end if;

  insert into public.event_participants
    (event_id, name, phone, amount_paid, payment_method, sold_at_gate, checked_in, checked_in_at)
  values
    (p_event, v_name, nullif(trim(p_phone), ''), p_amount, p_method, true, true, now())
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function gate_register_sale(uuid, text, text, numeric, public.payment_method) from public, anon;
grant execute on function gate_register_sale(uuid, text, text, numeric, public.payment_method) to authenticated;
