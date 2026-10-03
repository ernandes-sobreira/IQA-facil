-- IQA-Fácil: tabela e regras de segurança (Supabase > SQL Editor > Run)
-- Pode ser executado mais de uma vez sem apagar dados.
-- A API usa a chave pública (publishable). Quem protege os dados é o RLS abaixo:
-- sem ele, qualquer pessoa com a chave pública lê e apaga medições de todos.

create table if not exists public.iqa_measurements (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  local         text not null default 'Ponto não informado',
  collected_at  timestamptz not null default now(),
  responsible   text,
  notes         text,
  latitude      double precision,
  longitude     double precision,
  altitude_m    double precision,
  iqa           double precision not null check (iqa >= 0 and iqa <= 100),
  class         text,
  manual        boolean not null default false,
  "values"      jsonb not null default '{}'::jsonb,
  qis           jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists iqa_measurements_user_idx
  on public.iqa_measurements (user_id, collected_at desc);

alter table public.iqa_measurements enable row level security;
alter table public.iqa_measurements force row level security;

drop policy if exists "iqa select own" on public.iqa_measurements;
drop policy if exists "iqa insert own" on public.iqa_measurements;
drop policy if exists "iqa update own" on public.iqa_measurements;
drop policy if exists "iqa delete own" on public.iqa_measurements;

create policy "iqa select own" on public.iqa_measurements
  for select to authenticated using (auth.uid() = user_id);
create policy "iqa insert own" on public.iqa_measurements
  for insert to authenticated with check (auth.uid() = user_id);
create policy "iqa update own" on public.iqa_measurements
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "iqa delete own" on public.iqa_measurements
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.iqa_measurements from anon;

-- Conferência: as duas consultas abaixo devem mostrar rowsecurity = true e 4 políticas.
select relname, relrowsecurity as rowsecurity, relforcerowsecurity as forced
  from pg_class where oid = 'public.iqa_measurements'::regclass;
select policyname, cmd from pg_policies where tablename = 'iqa_measurements';

-- Se aparecerem outras políticas antigas na segunda consulta (por exemplo com "using (true)"),
-- apague-as: elas liberam leitura para todos mesmo com as políticas acima.
