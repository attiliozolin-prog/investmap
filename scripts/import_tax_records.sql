-- Execute este script no SQL Editor do Supabase para inserir retroativamente os registros de IR
-- das vendas de CSMG3F e PETR4F, baseadas nos cálculos dos seus informes da B3.

-- 1. Venda de PETR4F em 08/12/2023 (10 ações)
-- Compra anterior: 26/07/2023 (10 ações a R$ 30,80 = Custo Total R$ 308,00)
-- Venda: R$ 341,90. Lucro: R$ 33,90. Isento (< 20k).
INSERT INTO public.sell_tax_records (
    "id",
    "transactionId", 
    "assetId", 
    "assetTicker", 
    "sellDate", 
    "sellValue", 
    "costBasis", 
    "profitLoss", 
    "taxRate", 
    "taxDue", 
    "isExempt", 
    "exemptReason", 
    "isLoss", 
    "lossUsedForCompensation", 
    "taxPaid"
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(), -- Usando ID aleatório pois a transação exata não tem ID conhecido aqui
    gen_random_uuid(), 
    'PETR4', 
    '2023-12-08T12:00:00.000Z', 
    341.90, 
    308.00, 
    33.90, 
    0.15, 
    0, 
    true, 
    'Isenção para vendas de Ações até R$ 20.000,00 no mês.', 
    false, 
    0, 
    false
);

-- 2. Venda de CSMG3F em 16/01/2026 (80 ações)
-- Custo Médio: R$ 20,84
-- Venda: 80 ações a R$ 44,11 = R$ 3.528,80
-- Custo: R$ 1.667,20. Lucro: R$ 1.861,60. Isento (< 20k).
INSERT INTO public.sell_tax_records (
    "id",
    "transactionId", 
    "assetId", 
    "assetTicker", 
    "sellDate", 
    "sellValue", 
    "costBasis", 
    "profitLoss", 
    "taxRate", 
    "taxDue", 
    "isExempt", 
    "exemptReason", 
    "isLoss", 
    "lossUsedForCompensation", 
    "taxPaid"
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(), 
    'CSMG3', 
    '2026-01-16T12:00:00.000Z', 
    3528.80, 
    1667.20, 
    1861.60, 
    0.15, 
    0, 
    true, 
    'Isenção para vendas de Ações até R$ 20.000,00 no mês.', 
    false, 
    0, 
    false
);
