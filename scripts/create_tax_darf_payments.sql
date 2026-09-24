-- ════════════════════════════════════════════════════════════════
-- Migração: pagamentos de DARF por competência (apuração mensal de IR)
--
-- Antes, o pagamento era marcado em cada venda (sell_tax_records.tax_paid).
-- Com a apuração mensal (src/lib/taxApuration.ts), o DARF é um por mês e
-- por código (6015 bolsa/FII, 4600 cripto), e o valor pode mudar depois do
-- pagamento (venda registrada mais tarde → DARF complementar). Por isso o
-- pagamento guarda o VALOR pago, não só um "sim/não".
--
-- As marcações antigas em sell_tax_records continuam valendo como
-- pagamento — nada precisa ser migrado.
--
-- Seguro para rodar mais de uma vez (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ════════════════════════════════════════════════════════════════

create table if not exists tax_darf_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  darf_code text not null check (darf_code in ('6015', '4600')),
  amount numeric not null check (amount >= 0),
  paid_at date not null,
  created_at timestamptz not null default now()
);

create index if not exists tax_darf_payments_user_period_idx
  on tax_darf_payments (user_id, period);

alter table tax_darf_payments enable row level security;

drop policy if exists "Users manage their own DARF payments" on tax_darf_payments;
create policy "Users manage their own DARF payments"
  on tax_darf_payments
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
