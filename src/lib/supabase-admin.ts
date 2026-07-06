import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase com a SERVICE ROLE KEY — ignora RLS e tem acesso
 * administrativo (auth.admin). NUNCA importar em código client-side:
 * a chave dá acesso total ao banco e só existe no servidor.
 *
 * Retorna null se a chave não estiver configurada, para que as rotas
 * possam responder com um erro claro em vez de quebrar.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
