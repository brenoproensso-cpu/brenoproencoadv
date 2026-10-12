-- Visitantes únicos por dia, sem cookies: a função "registrar" grava um código anônimo
-- (IP + navegador + código que muda todo dia, embaralhados). O IP não é guardado.
alter table public.eventos add column if not exists visitante text;
create index if not exists eventos_visitante_idx on public.eventos (criado_em, visitante);

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
    'visitantes', (select count(distinct ((criado_em at time zone 'America/Sao_Paulo')::date, visitante)) from eventos where criado_em >= ini and visitante is not null),
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
        select coalesce(utm ->> 'source', nullif(referencia, ''), 'direto') as nome, count(distinct coalesce(visitante, sessao)) as total from eventos
        where tipo = 'visita' and criado_em >= ini group by 1 order by 2 desc limit 10) x), '[]'::jsonb),
    'dispositivos', coalesce((select jsonb_agg(x order by x.total desc) from (
        select coalesce(dispositivo, '?') as nome, count(distinct coalesce(visitante, sessao)) as total from eventos
        where tipo = 'visita' and criado_em >= ini group by 1) x), '[]'::jsonb),
    'leads_por_calculadora', coalesce((select jsonb_agg(x order by x.total desc) from (
        select coalesce(calculadora, 'sem cálculo') as nome, count(*) as total from leads
        where criado_em >= ini group by 1) x), '[]'::jsonb),
    'por_dia', coalesce((select jsonb_agg(x order by x.dia) from (
        select g::date as dia,
          coalesce((select count(*) from eventos e where e.tipo = 'visita' and (e.criado_em at time zone 'America/Sao_Paulo')::date = g::date and e.criado_em >= ini - interval '1 day'), 0) as visitas,
          coalesce((select count(distinct e.visitante) from eventos e where (e.criado_em at time zone 'America/Sao_Paulo')::date = g::date and e.criado_em >= ini - interval '1 day'), 0) as visitantes,
          coalesce((select count(*) from eventos e where e.tipo = 'calculo' and (e.criado_em at time zone 'America/Sao_Paulo')::date = g::date and e.criado_em >= ini - interval '1 day'), 0) as calculos,
          coalesce((select count(*) from leads l where (l.criado_em at time zone 'America/Sao_Paulo')::date = g::date and l.criado_em >= ini - interval '1 day'), 0) as leads
        from generate_series((ini at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') g) x), '[]'::jsonb)
  ) into res;
  return res;
end $$;
revoke all on function public.estatisticas(int) from public, anon;
grant execute on function public.estatisticas(int) to authenticated;
