'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { apurarIR, type TaxApuration } from '@/lib/taxApuration';

/**
 * Apuração mensal do IR a partir de TODOS os registros de venda (a
 * compensação de prejuízo atravessa anos) e dos pagamentos de DARF.
 * Fonte única para a página de Impostos, o Dashboard e o histórico.
 */
export function useTaxApuration(): TaxApuration {
  const { sellTaxRecords, darfPayments } = useApp();
  return useMemo(() => apurarIR(sellTaxRecords, darfPayments), [sellTaxRecords, darfPayments]);
}
