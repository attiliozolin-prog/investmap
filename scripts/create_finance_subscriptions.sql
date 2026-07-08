-- ════════════════════════════════════════════════════════════════
-- Migração: Monitor de Assinaturas + fechamento real de mês
-- Rode este script UMA VEZ no SQL Editor do seu projeto Supabase
-- (Dashboard → SQL Editor → New query → colar → Run).
--
-- É seguro rodar mais de uma vez: usa IF NOT EXISTS / ADD COLUMN IF NOT
-- EXISTS, então não duplica nem apaga nada já existente.
-- ════════════════════════════════════════════════════════════════

-- 1) Nova tabela: assinaturas recorrentes GLOBAIS (não pertencem a um mês —
--    aparecem automaticamente em todos os meses até serem removidas).
create table if not exists finance_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category text,
  value numeric not null,
  created_at timestamptz not null default now()
);

alter table finance_subscriptions enable row level security;

drop policy if exists "Users manage their own subscriptions" on finance_subscriptions;
create policy "Users manage their own subscriptions"
  on finance_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) Coluna que faltava em finance_months: sem ela, "Fechar mês"/"Reabrir"
--    só mudava a tela (nunca era salvo de verdade). Default 'open' preserva
--    todos os meses existentes como estavam.
alter table finance_months
  add column if not exists status text not null default 'open';

alter table finance_months
  add column if not exists updated_at timestamptz not null default now();
