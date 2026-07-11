import {
  Home, CreditCard, HeartPulse, Wrench, Receipt, BarChart3, Trophy, Zap,
  Gift, UtensilsCrossed, ShoppingCart, Car, GraduationCap, Tag, Shirt,
  Package, Dog, Scissors, Sofa, type LucideIcon,
} from 'lucide-react';

/**
 * O ícone é propriedade da CATEGORIA, não do lançamento — assim uma nova
 * categoria criada pelo usuário herda um ícone (o default, abaixo) sem
 * exigir que cada lançamento escolha o próprio ícone.
 *
 * Mapeado a partir de DEFAULT_CATEGORIES (FinanceContext.tsx). Categorias
 * criadas pelo usuário que não estejam aqui caem no ícone default.
 */
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  'Sobrevivência': Home,
  'Cartão Crédito': CreditCard,
  'Telefonia': Zap,
  'Esporte': Trophy,
  'Energia': Zap,
  'Limpeza e Manutenção': Wrench,
  'Saúde': HeartPulse,
  'Contabilidade': BarChart3,
  'Impostos': Receipt,
  'Lazer': UtensilsCrossed,
  'Alimentação': ShoppingCart,
  'Transporte': Car,
  'Vestuário': Shirt,
  'Compras Online': Package,
  'Pets': Dog,
  'Beleza': Scissors,
  'Casa': Sofa,
  'Educação': GraduationCap,
  'Presentes': Gift,
  'Outro': Tag,
};

export const DEFAULT_CATEGORY_ICON = Tag;

export function iconForCategory(name?: string): LucideIcon {
  if (!name) return DEFAULT_CATEGORY_ICON;
  return CATEGORY_ICON_MAP[name] ?? DEFAULT_CATEGORY_ICON;
}

/** Normaliza para comparação tolerante a acento/maiúsculas ("Cartão Crédito" ≈ "cartao de credito") */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Detecta se uma categoria representa a fatura do cartão de crédito —
 * usado para aplicar o status "≈ Previsto" com a média dos últimos meses
 * ao materializar um novo mês (o valor da fatura varia mês a mês).
 */
export function isCardCategory(name?: string): boolean {
  if (!name) return false;
  const n = normalize(name);
  return n.includes('cartao') && (n.includes('credito') || n.includes('cred'));
}
