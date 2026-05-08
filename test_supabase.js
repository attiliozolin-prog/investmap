const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2];
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // Ler o sql e fazer split em comandos
  const sql = fs.readFileSync('scripts/import_tax_records.sql', 'utf8');
  // O supabase-js REST API nao permite rodar SQL puro direto com o anon key sem uma function RPC (se não me engano).
  // Mas posso inserir linha a linha
  
  const records = [
    {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      transactionId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      assetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
      assetTicker: "PETR4",
      sellDate: "2023-12-08T12:00:00.000Z",
      sellValue: 341.90,
      costBasis: 308.00,
      profitLoss: 33.90,
      taxRate: 0.15,
      taxDue: 0,
      isExempt: true,
      exemptReason: "Isenção para vendas de Ações até R$ 20.000,00 no mês.",
      isLoss: false,
      lossUsedForCompensation: 0,
      taxPaid: false
    },
    {
      id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      transactionId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      assetId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
      assetTicker: "CSMG3",
      sellDate: "2026-01-16T12:00:00.000Z",
      sellValue: 3528.80,
      costBasis: 1667.20,
      profitLoss: 1861.60,
      taxRate: 0.15,
      taxDue: 0,
      isExempt: true,
      exemptReason: "Isenção para vendas de Ações até R$ 20.000,00 no mês.",
      isLoss: false,
      lossUsedForCompensation: 0,
      taxPaid: false
    }
  ];
  
  const { data, error } = await supabase.from('sell_tax_records').insert(records).select();
  if (error) console.error(error);
  else console.log('INSERIDO COM SUCESSO', data);
}
run();
