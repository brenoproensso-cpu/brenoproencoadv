-- Configurações privadas das funções (lidas só pelo servidor, com a chave de serviço)
create table if not exists public.ajustes (
  chave text primary key,
  valor text not null
);
alter table public.ajustes enable row level security;
revoke all on public.ajustes from anon, authenticated;
