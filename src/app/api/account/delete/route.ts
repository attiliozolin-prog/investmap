import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

// Ordem importante: filhas antes das pais para respeitar chaves estrangeiras.
const USER_TABLES = [
  'portfolio_snapshots',
  'transactions',
  'sell_tax_records',
  'financial_goals',
  'assets',
  'strategy_categories',
  'strategies',
  'finance_transactions',
  'finance_categories',
  'finance_months',
];

export async function POST() {
  // ── Autenticação: só o próprio dono pode apagar a conta ──
  const supabase = createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'Exclusão de conta indisponível: SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' },
      { status: 501 }
    );
  }

  const userId = user.id;

  // ── Apaga todos os dados do usuário ──
  for (const table of USER_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', userId);
    if (error) {
      return NextResponse.json(
        { error: `Falha ao apagar dados (${table}): ${error.message}` },
        { status: 500 }
      );
    }
  }

  // ── Apaga o próprio usuário de autenticação (e-mail é dado pessoal / LGPD) ──
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    return NextResponse.json(
      { error: `Dados apagados, mas falha ao remover o login: ${delErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
