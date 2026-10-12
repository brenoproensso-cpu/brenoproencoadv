-- Artigos do site, editados pelo painel único (/admin).
-- Público lê só os publicados; somente admins criam, editam e apagam.

create table if not exists public.artigos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  titulo text not null check (char_length(titulo) between 5 and 200),
  descricao text not null default '' check (char_length(descricao) <= 400),
  corpo text not null default '',
  calculadora text not null default 'simulador-de-aposentadoria'
    check (calculadora in ('tempo-de-contribuicao', 'simulador-de-aposentadoria', 'valor-do-beneficio', 'bpc-loas', 'pensao-por-morte', 'auxilio-doenca')),
  nota text not null default 'Conteúdo informativo. A análise depende dos documentos e do histórico de cada pessoa.',
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  ordem int not null default 999,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  origem text not null default 'manual' check (origem in ('manual', 'ia')),
  observacoes_ia text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists artigos_status_idx on public.artigos (status, data desc);

alter table public.artigos enable row level security;

revoke all on public.artigos from anon, authenticated;
grant select on public.artigos to anon, authenticated;
grant insert, update, delete on public.artigos to authenticated;

drop policy if exists artigos_publicos on public.artigos;
create policy artigos_publicos on public.artigos for select to anon, authenticated using (status = 'publicado');
drop policy if exists artigos_admin_select on public.artigos;
create policy artigos_admin_select on public.artigos for select to authenticated using (public.is_admin());
drop policy if exists artigos_admin_insert on public.artigos;
create policy artigos_admin_insert on public.artigos for insert to authenticated with check (public.is_admin());
drop policy if exists artigos_admin_update on public.artigos;
create policy artigos_admin_update on public.artigos for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists artigos_admin_delete on public.artigos;
create policy artigos_admin_delete on public.artigos for delete to authenticated using (public.is_admin());

drop trigger if exists artigos_touch on public.artigos;
create trigger artigos_touch before update on public.artigos for each row execute function public.leads_touch();
