-- Adiciona quantidade e preço unitário às transações.
-- Permite recalcular quantity/avgPrice do ativo ao excluir uma transação
-- (replay do histórico), em vez de deixar a quantidade órfã.
-- Aplicar no SQL Editor do Supabase.

alter table public.transactions
  add column if not exists quantity numeric,
  add column if not exists unit_price numeric;

comment on column public.transactions.quantity is 'Quantidade de cotas/ações movimentadas na operação (nullable; transações antigas não têm)';
comment on column public.transactions.unit_price is 'Preço unitário pago/recebido na operação (nullable; transações antigas não têm)';
