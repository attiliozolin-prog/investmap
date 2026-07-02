/**
 * Mapeamento entre os ids de aba legados (usados pelo Navbar e pelos
 * onNavigate das views) e as rotas reais do App Router.
 */

export const TAB_TO_ROUTE: Record<string, string> = {
  dashboard: '/',
  assets: '/carteira',
  finances: '/financas',
  taxes: '/impostos',
  strategy: '/estrategia',
  profile: '/perfil',
};

export function routeForTab(tab: string): string {
  return TAB_TO_ROUTE[tab] ?? '/';
}

export function tabForPathname(pathname: string): string {
  const entry = Object.entries(TAB_TO_ROUTE).find(([, route]) =>
    route === '/' ? pathname === '/' : pathname.startsWith(route)
  );
  return entry?.[0] ?? 'dashboard';
}
