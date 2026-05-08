BEGIN;

DELETE FROM transactions WHERE user_id = 'e21ec85c-5268-43ff-9991-421876edc426' AND asset_id IN (
  '1774827416091-28worocwqia', 
  '1774827448888-yja1cuxijq', 
  '1774827127977-6g6wyw1jae7', 
  '1774827165470-ll55ktlonvf', 
  '1774827582958-7j5tuuev8i9', 
  '1774827653887-ofvlzrdvkdb', 
  '1774827934098-jqm5o5qsnq', 
  '1774827614181-ju8n4e18qtk', 
  '1774827006062-r2pz2evcsp', 
  '1774828005056-swn37wph8h', 
  '1774827974250-izlv4ec8yw', 
  '1774827693913-zpadtxkig5', 
  '1774827730357-p6xun0wbe', 
  '1774828036590-t336ljs9xda', 
  '1774827774169-6jwafvil4g'
);

DELETE FROM sell_tax_records WHERE user_id = 'e21ec85c-5268-43ff-9991-421876edc426' AND asset_id IN (
  '1774827416091-28worocwqia', 
  '1774827448888-yja1cuxijq', 
  '1774827127977-6g6wyw1jae7', 
  '1774827165470-ll55ktlonvf', 
  '1774827582958-7j5tuuev8i9', 
  '1774827653887-ofvlzrdvkdb', 
  '1774827934098-jqm5o5qsnq', 
  '1774827614181-ju8n4e18qtk', 
  '1774827006062-r2pz2evcsp', 
  '1774828005056-swn37wph8h', 
  '1774827974250-izlv4ec8yw', 
  '1774827693913-zpadtxkig5', 
  '1774827730357-p6xun0wbe', 
  '1774828036590-t336ljs9xda', 
  '1774827774169-6jwafvil4g'
);

-- Transactions
INSERT INTO transactions (id, asset_id, user_id, type, value, quantity, price, date, notes) VALUES
(gen_random_uuid(), '1774827693913-zpadtxkig5', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 308.00, 10, 30.80, '2023-07-26', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827693913-zpadtxkig5', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 4950.47, 160, 30.94, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827693913-zpadtxkig5', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 1112.21, 35, 31.78, '2025-11-28', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774827582958-7j5tuuev8i9', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 4689.25, 225, 20.84, '2025-05-09', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774827974250-izlv4ec8yw', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 2976.00, 320, 9.30, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827974250-izlv4ec8yw', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 991.12, 104, 9.53, '2025-09-03', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827974250-izlv4ec8yw', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 4027.80, 420, 9.59, '2025-11-04', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827974250-izlv4ec8yw', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 950.00, 100, 9.50, '2026-01-20', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774828005056-swn37wph8h', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 2863.04, 20, 143.15, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774828005056-swn37wph8h', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 994.00, 7, 142.00, '2025-09-03', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774828005056-swn37wph8h', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 3938.22, 27, 145.86, '2025-11-04', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774828005056-swn37wph8h', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 478.14, 3, 159.38, '2026-01-20', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774827934098-jqm5o5qsnq', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 2875.50, 18, 159.75, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827934098-jqm5o5qsnq', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 933.00, 6, 155.50, '2025-09-03', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827934098-jqm5o5qsnq', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 3916.50, 25, 156.66, '2025-11-04', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827934098-jqm5o5qsnq', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 633.56, 4, 158.39, '2026-03-02', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774828036590-t336ljs9xda', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 2898.92, 28, 103.53, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774828036590-t336ljs9xda', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 926.19, 9, 102.91, '2025-09-03', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774828036590-t336ljs9xda', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 3919.41, 37, 105.93, '2025-11-04', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774828036590-t336ljs9xda', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 548.25, 5, 109.65, '2026-01-20', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774827416091-28worocwqia', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 4691.34, 158, 29.69, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827416091-28worocwqia', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 1004.64, 39, 25.76, '2025-05-16', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827416091-28worocwqia', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 979.68, 48, 20.41, '2025-09-03', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827416091-28worocwqia', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 487.20, 24, 20.30, '2025-10-16', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827416091-28worocwqia', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 1077.50, 50, 21.55, '2026-01-20', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774827448888-yja1cuxijq', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 4696.39, 122, 38.49, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827448888-yja1cuxijq', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 964.20, 30, 32.14, '2025-09-03', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827448888-yja1cuxijq', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 480.00, 15, 32.00, '2025-10-16', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827448888-yja1cuxijq', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 679.20, 20, 33.96, '2025-11-28', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774827614181-ju8n4e18qtk', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 2873.52, 260, 11.05, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827614181-ju8n4e18qtk', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 493.65, 45, 10.97, '2025-10-16', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827614181-ju8n4e18qtk', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 2006.00, 170, 11.80, '2025-11-06', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827614181-ju8n4e18qtk', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 492.96, 40, 12.32, '2025-11-28', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774827730357-p6xun0wbe', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 2862.40, 80, 35.78, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827730357-p6xun0wbe', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 2001.00, 50, 40.02, '2025-11-06', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827730357-p6xun0wbe', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 654.15, 15, 43.61, '2025-11-28', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774827653887-ofvlzrdvkdb', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 4709.73, 118, 39.91, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827653887-ofvlzrdvkdb', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 1073.25, 25, 42.93, '2025-11-07', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774827006062-r2pz2evcsp', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 28606.64, 80, 357.58, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827127977-6g6wyw1jae7', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 11859.00, 300, 39.53, '2025-05-09', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827165470-ll55ktlonvf', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 11827.20, 160, 73.92, '2025-05-09', 'Importado do Extrato B3'),

(gen_random_uuid(), '1774827774169-6jwafvil4g', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 2414.40, 60, 40.24, '2023-08-11', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827774169-6jwafvil4g', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 431.88, 12, 35.99, '2023-09-19', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827774169-6jwafvil4g', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 348.50, 10, 34.85, '2023-12-12', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827774169-6jwafvil4g', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 101.49, 3, 33.83, '2024-01-24', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827774169-6jwafvil4g', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 488.93, 13, 37.61, '2025-10-16', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827774169-6jwafvil4g', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 1959.75, 45, 43.55, '2025-11-06', 'Importado do Extrato B3'),
(gen_random_uuid(), '1774827774169-6jwafvil4g', 'e21ec85c-5268-43ff-9991-421876edc426', 'buy', 662.62, 15, 44.17, '2025-11-28', 'Importado do Extrato B3');

-- Sales
INSERT INTO sell_tax_records (id, user_id, asset_id, asset_ticker, sell_value, cost_basis, profit_loss, asset_type, tax_rate, tax_due, is_exempt, exempt_reason, is_loss, loss_used_for_compensation, tax_paid, tax_paid_at, darf_period, notes, sell_date, created_at) VALUES
(gen_random_uuid(), 'e21ec85c-5268-43ff-9991-421876edc426', '1774827693913-zpadtxkig5', 'PETR4', 341.90, 308.00, 33.90, 'stock', 0.15, 0, true, 'Venda de ações (comum) abaixo de 20 mil reais no mês', false, 0, false, null, '2023-12', 'Importado do Extrato B3', '2023-12-08', now()),
(gen_random_uuid(), 'e21ec85c-5268-43ff-9991-421876edc426', '1774827582958-7j5tuuev8i9', 'CSMG3', 3528.80, 1667.28, 1861.52, 'stock', 0.15, 0, true, 'Venda de ações (comum) abaixo de 20 mil reais no mês', false, 0, false, null, '2026-01', 'Importado do Extrato B3', '2026-01-20', now());

COMMIT;
