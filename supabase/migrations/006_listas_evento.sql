-- =====================================================================
-- Arena São João — listas de Cortesias e Divulgação nos eventos
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 005).
-- =====================================================================

-- Cada nome do evento pertence a uma lista. Quem já está cadastrado
-- continua como pagante. Todas as listas formam a lista final do evento,
-- e a portaria já enxerga todos, sem nenhuma mudança.
alter table event_participants
  add column if not exists list_type text not null default 'pagante'
  check (list_type in ('pagante', 'cortesia', 'divulgacao'));
