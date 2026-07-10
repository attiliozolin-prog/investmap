import { describe, it, expect } from 'vitest';
import { fallbackCategory, isUselessCategory } from './importCategoryRules';

const CATS = [
  'Sobrevivência', 'Cartão Crédito', 'Telefonia', 'Esporte', 'Energia',
  'Saúde', 'Impostos', 'Lazer', 'Alimentação', 'Transporte', 'Vestuário', 'Outro',
];

describe('fallbackCategory', () => {
  it('reconhece variações de Uber como Transporte', () => {
    expect(fallbackCategory('Uber Rides', CATS)).toBe('Transporte');
    expect(fallbackCategory('UBER *TRIP HELP.UBER.COM', CATS)).toBe('Transporte');
    expect(fallbackCategory('Uberrides', CATS)).toBe('Transporte'); // sem word-boundary
  });

  it('reconhece 99 e postos como Transporte', () => {
    expect(fallbackCategory('99app *99app', CATS)).toBe('Transporte');
    expect(fallbackCategory('Posto Shell BR', CATS)).toBe('Transporte');
  });

  it('reconhece Apple Bill/iCloud apenas se houver categoria compatível', () => {
    // Sem categoria de nuvem/assinatura no usuário → null (não força)
    expect(fallbackCategory('Apple.Com/Bill', CATS)).toBeNull();
    expect(fallbackCategory('Apple.Com/Bill', [...CATS, 'Nuvem'])).toBe('Nuvem');
    expect(fallbackCategory('APPLE COM BILL', [...CATS, 'Assinaturas'])).toBe('Assinaturas');
  });

  it('reconhece lojas de roupa como Vestuário', () => {
    expect(fallbackCategory('Shein *Shein', CATS)).toBe('Vestuário');
    expect(fallbackCategory('Lojas Renner', CATS)).toBe('Vestuário');
  });

  it('reconhece delivery e mercado como Alimentação', () => {
    expect(fallbackCategory('Ifood *Restaurante', CATS)).toBe('Alimentação');
    expect(fallbackCategory('Supermercado Pão de Açúcar', CATS)).toBe('Alimentação');
  });

  it('retorna null para estabelecimento desconhecido', () => {
    expect(fallbackCategory('Xyz Comercio Ltda', CATS)).toBeNull();
  });
});

describe('isUselessCategory', () => {
  it('null e Outro são inúteis; categorias reais não', () => {
    expect(isUselessCategory(null)).toBe(true);
    expect(isUselessCategory('Outro')).toBe(true);
    expect(isUselessCategory('outro ')).toBe(true);
    expect(isUselessCategory('Transporte')).toBe(false);
  });
});
