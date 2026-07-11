import { describe, it, expect } from 'vitest';
import {
  fallbackCategory, isUselessCategory, merchantKey, buildCategoryHints, resolveCategory,
} from './importCategoryRules';

const CATS = [
  'Sobrevivência', 'Cartão Crédito', 'Telefonia', 'Esporte', 'Energia',
  'Saúde', 'Impostos', 'Lazer', 'Alimentação', 'Transporte', 'Vestuário',
  'Pets', 'Beleza', 'Casa', 'Outro',
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
    expect(fallbackCategory('Lojas Renner', CATS)).toBe('Vestuário');
    expect(fallbackCategory('Zara Brasil', CATS)).toBe('Vestuário');
  });

  it('reconhece marketplaces genéricos como Compras Online (Shein incluído, prevalece sobre Vestuário)', () => {
    const catsComOnline = [...CATS, 'Compras Online'];
    expect(fallbackCategory('Mercado Livre', catsComOnline)).toBe('Compras Online');
    expect(fallbackCategory('Amazon.Com.Br', catsComOnline)).toBe('Compras Online');
    expect(fallbackCategory('Aliexpress', catsComOnline)).toBe('Compras Online');
    expect(fallbackCategory('Temu', catsComOnline)).toBe('Compras Online');
    expect(fallbackCategory('Shopee *Shopee', catsComOnline)).toBe('Compras Online');
    expect(fallbackCategory('Shein *Shein', catsComOnline)).toBe('Compras Online');
    // Sem categoria de compras online no usuário → null (não força Vestuário)
    expect(fallbackCategory('Shein *Shein', CATS)).toBeNull();
  });

  it('reconhece delivery e mercado como Alimentação', () => {
    expect(fallbackCategory('Ifood *Restaurante', CATS)).toBe('Alimentação');
    expect(fallbackCategory('Supermercado Pão de Açúcar', CATS)).toBe('Alimentação');
  });

  it('reconhece pet shops como Pets (não Alimentação)', () => {
    expect(fallbackCategory('Cobasi Brasilia Asa No', CATS)).toBe('Pets');
    expect(fallbackCategory('Petz *Petz', CATS)).toBe('Pets');
    expect(fallbackCategory('Petlove', CATS)).toBe('Pets');
  });

  it('reconhece salão/perfumaria como Beleza', () => {
    expect(fallbackCategory('O Boticario', CATS)).toBe('Beleza');
    expect(fallbackCategory('Salao da Maria', CATS)).toBe('Beleza');
    expect(fallbackCategory('Sephora Br', CATS)).toBe('Beleza');
  });

  it('reconhece lojas do lar como Casa', () => {
    expect(fallbackCategory('Leroy Merlin', CATS)).toBe('Casa');
    expect(fallbackCategory('Havan Filial', CATS)).toBe('Casa');
  });

  it('retorna null para estabelecimento desconhecido', () => {
    expect(fallbackCategory('Xyz Comercio Ltda', CATS)).toBeNull();
  });
});

describe('merchantKey', () => {
  it('usa a primeira palavra significativa, tolerante a acento/caixa', () => {
    expect(merchantKey('Cobasi Brasilia Asa No')).toBe('cobasi');
    expect(merchantKey('COBASI ASA SUL')).toBe('cobasi');
    expect(merchantKey('Uber *Trip')).toBe('uber');
  });
  it('junta a segunda palavra quando a primeira é muito curta', () => {
    expect(merchantKey('DM Farma Center')).toBe('dm farma');
  });
});

describe('buildCategoryHints + resolveCategory (aprendizado)', () => {
  const hist = [
    { description: 'Padaria do Ze', category: 'Alimentação' },
    { description: 'Padaria do Ze Matriz', category: 'Alimentação' }, // 2ª vez → count 2
    { description: 'Cobasi Asa Sul', category: 'Pets' },
    { description: 'Barraca Sem Categoria', category: 'Outro' }, // ignorado (inútil)
  ];

  it('preenche "Outro"/null com a categoria aprendida', () => {
    const hints = buildCategoryHints(hist);
    // servidor não categorizou; histórico conhece "padaria"
    expect(resolveCategory(null, 'Padaria do Ze Filial 3', hints, CATS)).toBe('Alimentação');
    expect(resolveCategory('Outro', 'Cobasi Barra', hints, CATS)).toBe('Pets');
  });

  it('categoria útil da IA só é sobreposta por histórico repetido (≥2×)', () => {
    const hints = buildCategoryHints(hist);
    // "padaria" tem count 2 → sobrepõe o palpite da IA
    expect(resolveCategory('Lazer', 'Padaria do Ze', hints, CATS)).toBe('Alimentação');
    // "cobasi" tem count 1 → respeita a IA (não sobrepõe)
    expect(resolveCategory('Saúde', 'Cobasi Norte', hints, CATS)).toBe('Saúde');
  });

  it('ignora hint cuja categoria foi apagada pelo usuário', () => {
    const hints = buildCategoryHints([
      { description: 'Loja X', category: 'CategoriaQueNaoExisteMais' },
    ]);
    expect(resolveCategory(null, 'Loja X', hints, CATS)).toBeNull();
  });

  it('não inventa hint para estabelecimento nunca visto', () => {
    const hints = buildCategoryHints(hist);
    expect(resolveCategory(null, 'Comercio Novo', hints, CATS)).toBeNull();
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
