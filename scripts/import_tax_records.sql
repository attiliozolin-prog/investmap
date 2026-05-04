-- Execute este script no SQL Editor do Supabase para inserir retroativamente os registros de IR
-- das vendas de CSMG3F e PETR4F, baseadas nos cálculos dos seus informes da B3.

-- 1. Venda de PETR4F em 08/12/2023 (10 ações)
INSERT INTO public.sell_tax_records (
    "id",
    "user_id",
    "asset_id", 
    "asset_ticker", 
    "sell_date", 
    "sell_value", 
    "cost_basis", 
    "profit_loss", 
    "asset_type",
    "tax_rate", 
    "tax_due", 
    "is_exempt", 
    "exempt_reason", 
    "is_loss", 
    "loss_used_for_compensation", 
    "tax_paid"
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM auth.users LIMIT 1), -- Pega o ID do seu usuário automaticamente
    gen_random_uuid(), 
    'PETR4', 
    '2023-12-08T12:00:00.000Z', 
    341.90, 
    308.00, 
    33.90, 
    'stocks',
    0.15, 
    0, 
    true, 
    'Isenção para vendas de Ações até R$ 20.000,00 no mês.', 
    false, 
    0, 
    false
);

-- 2. Venda de CSMG3F em 16/01/2026 (80 ações)
INSERT INTO public.sell_tax_records (
    "id",
    "user_id",
    "asset_id", 
    "asset_ticker", 
    "sell_date", 
    "sell_value", 
    "cost_basis", 
    "profit_loss", 
    "asset_type",
    "tax_rate", 
    "tax_due", 
    "is_exempt", 
    "exempt_reason", 
    "is_loss", 
    "loss_used_for_compensation", 
    "tax_paid"
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM auth.users LIMIT 1),
    gen_random_uuid(), 
    'CSMG3', 
    '2026-01-16T12:00:00.000Z', 
    3528.80, 
    1667.20, 
    1861.60, 
    'stocks',
    0.15, 
    0, 
    true, 
    'Isenção para vendas de Ações até R$ 20.000,00 no mês.', 
    false, 
    0, 
    false
);
