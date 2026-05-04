const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2];
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: assets, error: e1 } = await supabase.from('assets').select('*');
  console.log('Assets:', assets?.length || e1);
  if (assets?.length > 0) console.log(assets[0]);
  
  const { data: tx, error: e2 } = await supabase.from('transactions').select('*');
  console.log('\nTransactions:', tx?.length || e2);
  if (tx?.length > 0) console.log(tx[0]);
  
  const { data: tax, error: e3 } = await supabase.from('sell_tax_records').select('*');
  console.log('\nTax Records:', tax?.length || e3);
  if (tax?.length > 0) console.log(tax[0]);
}

check();
