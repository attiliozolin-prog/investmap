/**
 * Auditoria de Row Level Security (RLS) — InvestMap
 *
 * A anon key do Supabase é pública por design: qualquer visitante do site
 * a possui. A ÚNICA barreira entre um usuário e os dados dos outros são
 * as policies de RLS. Este script verifica se elas estão fazendo o trabalho.
 *
 * Uso:
 *   node scripts/audit-rls.mjs
 *
 * Testes com usuário autenticado (opcional, recomendado):
 *   TEST_EMAIL=voce@example.com TEST_PASSWORD=... node scripts/audit-rls.mjs
 *
 * O que é testado:
 *   1. SELECT sem autenticação  → deve retornar 0 linhas ou erro
 *   2. INSERT sem autenticação  → deve falhar
 *   3. (autenticado) SELECT de linhas de OUTROS user_id → deve retornar 0
 *   4. (autenticado) INSERT com user_id de outra pessoa → deve falhar
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── Carrega .env.local manualmente (sem dependência de dotenv) ──
const root = dirname(dirname(fileURLToPath(import.meta.url)));
try {
  const env = readFileSync(join(root, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { /* .env.local ausente — usa env do shell */ }

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_ || !ANON) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não encontradas.');
  process.exit(1);
}

const TABLES = [
  'strategies',
  'strategy_categories',
  'assets',
  'transactions',
  'portfolio_snapshots',
  'sell_tax_records',
  'financial_goals',
  'finance_months',
  'finance_categories',
  'finance_transactions',
];

let failures = 0;
const fail = (msg) => { failures++; console.log(`  🔴 FALHA  ${msg}`); };
const pass = (msg) => console.log(`  🟢 OK     ${msg}`);
const warn = (msg) => console.log(`  🟡 AVISO  ${msg}`);

// ─────────────────────────────────────────────────────────────
console.log('\n═══ 1. Acesso NÃO autenticado (anon key pura) ═══\n');

const anon = createClient(URL_, ANON, { auth: { persistSession: false } });

for (const table of TABLES) {
  const { data, error } = await anon.from(table).select('*').limit(5);
  if (error) {
    pass(`${table}: SELECT bloqueado (${error.code ?? error.message})`);
  } else if (data.length === 0) {
    pass(`${table}: SELECT retornou 0 linhas`);
  } else {
    fail(`${table}: SELECT sem auth retornou ${data.length} linha(s) — RLS AUSENTE OU ERRADA! Amostra: ${JSON.stringify(data[0]).slice(0, 120)}`);
  }
}

console.log('');
{
  const { error } = await anon.from('strategies').insert({
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    name: 'rls-audit-probe',
  });
  if (error) pass(`INSERT sem auth bloqueado (${error.code ?? error.message})`);
  else fail('INSERT sem auth FUNCIONOU — RLS de escrita ausente! Apague a linha "rls-audit-probe".');
}

// ─────────────────────────────────────────────────────────────
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

if (!email || !password) {
  console.log('\n═══ 2. Acesso autenticado — PULADO ═══');
  warn('Defina TEST_EMAIL e TEST_PASSWORD para testar isolamento entre usuários.');
} else {
  console.log('\n═══ 2. Acesso autenticado (isolamento entre usuários) ═══\n');

  const authed = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await authed.auth.signInWithPassword({ email, password });

  if (signInErr) {
    warn(`Login falhou: ${signInErr.message}`);
  } else {
    const myId = signIn.user.id;
    console.log(`  Logado como ${email} (${myId})\n`);

    for (const table of TABLES) {
      // Tenta ler linhas que NÃO são minhas. RLS correta filtra para 0.
      const { data, error } = await authed.from(table).select('*').neq('user_id', myId).limit(5);
      if (error) {
        pass(`${table}: SELECT de outros usuários bloqueado (${error.code ?? error.message})`);
      } else if (data.length === 0) {
        pass(`${table}: 0 linhas de outros usuários visíveis`);
      } else {
        fail(`${table}: consigo LER ${data.length} linha(s) de OUTROS usuários!`);
      }
    }

    console.log('');
    // Tenta gravar uma linha em nome de outro usuário
    const { error: spoofErr } = await authed.from('strategies').insert({
      id: crypto.randomUUID(),
      user_id: crypto.randomUUID(), // user_id forjado
      name: 'rls-audit-spoof',
    });
    if (spoofErr) pass(`INSERT com user_id forjado bloqueado (${spoofErr.code ?? spoofErr.message})`);
    else fail('INSERT com user_id de OUTRA pessoa funcionou! Policy de INSERT precisa de WITH CHECK (auth.uid() = user_id). Apague a linha "rls-audit-spoof".');
  }
}

// ─────────────────────────────────────────────────────────────
console.log('\n═══ Resultado ═══\n');
if (failures === 0) {
  console.log('✅ Nenhuma falha de RLS detectada nos testes executados.\n');
} else {
  console.log(`❌ ${failures} falha(s). Corrija no Supabase Dashboard → Authentication → Policies.`);
  console.log('   Para cada tabela: ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;');
  console.log('   e policies USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id).\n');
  process.exit(1);
}
