-- =====================================================================
-- Arena São João — imagens dos eventos
-- Rode este arquivo no SQL Editor do Supabase (depois do 001_init.sql).
-- =====================================================================

-- Caminho da imagem do evento dentro do bucket "eventos"
alter table events add column if not exists image_path text;

-- Bucket público para as artes dos eventos (até 5 MB, só imagens).
-- Público = qualquer pessoa com o link vê a imagem (é a arte de divulgação);
-- enviar, trocar e apagar continua restrito a usuários logados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eventos', 'eventos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "eventos_auth_select" on storage.objects
  for select to authenticated using (bucket_id = 'eventos');

create policy "eventos_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'eventos');

create policy "eventos_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'eventos') with check (bucket_id = 'eventos');

create policy "eventos_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'eventos');
