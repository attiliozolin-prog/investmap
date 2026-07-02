import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Cliente Supabase para route handlers (server-side).
 * Lê a sessão dos cookies gravados pelo createBrowserClient.
 * Use sempre auth.getUser() (valida o JWT no servidor Supabase),
 * nunca auth.getSession() (confia no cookie sem validar).
 */
export function createServerSupabase() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Route handlers podem gravar cookies (refresh de token)
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado de um Server Component — pode ignorar com middleware ausente
          }
        },
      },
    }
  );
}
