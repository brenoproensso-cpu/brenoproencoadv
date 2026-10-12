-- Banco de leads e estatísticas do site Breno Proenço
-- Segurança: RLS ligado em todas as tabelas. O público (anon) não lê nem grava nada.
-- Gravação: só pela Edge Function "registrar" (service role). Leitura: só e-mails da tabela admins.

create extension if not exists pgcrypto;

-- Quem pode ver o painel
create table if not exists public.admins (
  email text primary key
);

-- Leads (pessoas que pediram contato)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  nome text not null check (char_length(nome) between 2 and 120),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  calculadora text,
  resumo text,
  entradas jsonb,
  pagina text,
  referencia text,
  utm jsonb,
  sessao text,
  dispositivo text,
  consentimento_texto text not null,
  consentimento_versao text not null,
  consentimento_em timestamptz not null default now(),
  status text not null default 'novo'
    check (status in ('novo', 'contatado', 'em_analise', 'cliente', 'nao_seguiu')),
  notas text,
  proximo_contato date,
  atualizado_em timestamptz not null default now()
);
create index if not exists leads_criado_idx on public.leads (criado_em desc);

-- Eventos anônimos (sem nome, telefone ou IP)
create table if not exists public.eventos (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  tipo text not null check (tipo in ('visita', 'calculo', 'whatsapp')),
  pagina text,
  calculadora text,
  resumo text,
  referencia text,
  utm jsonb,
  dispositivo text,
  sessao text
);
create index if not exists eventos_criado_idx on public.eventos (criado_em desc);
create index if not exists eventos_tipo_idx on public.eventos (tipo, criado_em desc);

-- Controle anti-abuso (IP guardado só como hash, apagado em 24 h)
create table if not exists public.limites (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  tipo text not null,
  criado_em timestamptz not null default now()
);
create index if not exists limites_idx on public.limites (ip_hash, tipo, criado_em desc);

-- RLS em tudo
alter table public.admins enable row level security;
alter table public.leads enable row level security;
alter table public.eventos enable row level security;
alter table public.limites enable row level security;

-- Nada para o público
revoke all on public.admins, public.leads, public.eventos, public.limites from anon;
revoke all on public.admins, public.limites from authenticated;
revoke insert, delete on public.leads from authenticated;
revoke insert, update, delete on public.eventos from authenticated;

-- É administrador?
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Leads: admin lê e atualiza (status, notas, próximo contato)
drop policy if exists leads_admin_select on public.leads;
create policy leads_admin_select on public.leads for select to authenticated using (public.is_admin());
drop policy if exists leads_admin_update on public.leads;
create policy leads_admin_update on public.leads for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Eventos: admin lê
drop policy if exists eventos_admin_select on public.eventos;
create policy eventos_admin_select on public.eventos for select to authenticated using (public.is_admin());

-- Admin só pode mudar o acompanhamento, nunca os dados que a pessoa enviou
revoke update on public.leads from authenticated;
grant select on public.leads, public.eventos to authenticated;
grant update (status, notas, proximo_contato) on public.leads to authenticated;

create or replace function public.leads_touch()
returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads for each row execute function public.leads_touch();

-- Estatísticas agregadas para o painel
create or replace function public.estatisticas(dias int default 30)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  ini timestamptz := now() - make_interval(days => greatest(1, least(dias, 730)));
  res jsonb;
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'visitas',   (select count(*) from eventos where tipo = 'visita' and criado_em >= ini),
    'sessoes',   (select count(distinct sessao) from eventos where criado_em >= ini and sessao is not null),
    'calculos',  (select count(*) from eventos where tipo = 'calculo' and criado_em >= ini),
    'whatsapp',  (select count(*) from eventos where tipo = 'whatsapp' and criado_em >= ini),
    'leads',     (select count(*) from leads where criado_em >= ini),
    'por_calculadora', coalesce((select jsonb_agg(x order by x.total desc) from (
        select calculadora as nome, count(*) as total from eventos
        where tipo = 'calculo' and criado_em >= ini and calculadora is not null group by 1) x), '[]'::jsonb),
    'paginas', coalesce((select jsonb_agg(x order by x.total desc) from (
        select pagina as nome, count(*) as total from eventos
        where tipo = 'visita' and criado_em >= ini group by 1 order by 2 desc limit 12) x), '[]'::jsonb),
    'origens', coalesce((select jsonb_agg(x order by x.total desc) from (
        select coalesce(utm ->> 'source', nullif(referencia, ''), 'direto') as nome, count(*) as total from eventos
        where tipo = 'visita' and criado_em >= ini group by 1 order by 2 desc limit 10) x), '[]'::jsonb),
    'dispositivos', coalesce((select jsonb_agg(x order by x.total desc) from (
        select coalesce(dispositivo, '?') as nome, count(*) as total from eventos
        where tipo = 'visita' and criado_em >= ini group by 1) x), '[]'::jsonb),
    'leads_por_calculadora', coalesce((select jsonb_agg(x order by x.total desc) from (
        select coalesce(calculadora, 'sem cálculo') as nome, count(*) as total from leads
        where criado_em >= ini group by 1) x), '[]'::jsonb),
    'por_dia', coalesce((select jsonb_agg(x order by x.dia) from (
        select g::date as dia,
          coalesce((select count(*) from eventos e where e.tipo = 'visita' and (e.criado_em at time zone 'America/Sao_Paulo')::date = g::date and e.criado_em >= ini - interval '1 day'), 0) as visitas,
          coalesce((select count(*) from eventos e where e.tipo = 'calculo' and (e.criado_em at time zone 'America/Sao_Paulo')::date = g::date and e.criado_em >= ini - interval '1 day'), 0) as calculos,
          coalesce((select count(*) from leads l where (l.criado_em at time zone 'America/Sao_Paulo')::date = g::date and l.criado_em >= ini - interval '1 day'), 0) as leads
        from generate_series((ini at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') g) x), '[]'::jsonb)
  ) into res;
  return res;
end $$;
revoke all on function public.estatisticas(int) from public, anon;
grant execute on function public.estatisticas(int) to authenticated;
