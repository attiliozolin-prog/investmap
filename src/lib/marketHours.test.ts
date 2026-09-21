import { describe, it, expect } from 'vitest';
import { isB3Open, lastClosedSessionKey } from './marketHours';

// Brasília é UTC-3 o ano todo (sem horário de verão desde 2019), então
// 13:00Z = 10:00 em São Paulo. Os testes usam instantes UTC explícitos
// para não depender do fuso da máquina que roda a suíte.
const utc = (iso: string) => new Date(iso);

describe('isB3Open', () => {
  it('abre às 10h de Brasília numa quarta', () => {
    // 2026-09-16 é uma quarta-feira.
    expect(isB3Open(utc('2026-09-16T12:59:00Z'))).toBe(false); // 09h59
    expect(isB3Open(utc('2026-09-16T13:00:00Z'))).toBe(true);  // 10h00
  });

  it('fecha às 18h de Brasília', () => {
    expect(isB3Open(utc('2026-09-16T20:59:00Z'))).toBe(true);  // 17h59
    expect(isB3Open(utc('2026-09-16T21:00:00Z'))).toBe(false); // 18h00
  });

  it('não abre no fim de semana, mesmo em horário comercial', () => {
    // 2026-09-19 sábado, 2026-09-20 domingo.
    expect(isB3Open(utc('2026-09-19T15:00:00Z'))).toBe(false);
    expect(isB3Open(utc('2026-09-20T15:00:00Z'))).toBe(false);
  });

  it('não depende do fuso do aparelho — meia-noite UTC é 21h em SP', () => {
    // 00h00Z de quinta = 21h00 de quarta em São Paulo: fechado.
    expect(isB3Open(utc('2026-09-17T00:00:00Z'))).toBe(false);
  });
});

describe('lastClosedSessionKey', () => {
  it('durante o pregão, aponta para o dia útil anterior', () => {
    // Quarta 14h de Brasília: o pregão de hoje ainda não fechou.
    expect(lastClosedSessionKey(utc('2026-09-16T17:00:00Z'))).toBe('2026-09-15');
  });

  it('depois do fechamento, aponta para o próprio dia', () => {
    // Quarta 18h30 de Brasília.
    expect(lastClosedSessionKey(utc('2026-09-16T21:30:00Z'))).toBe('2026-09-16');
  });

  it('no fim de semana, aponta para a sexta anterior', () => {
    // 2026-09-18 é sexta; sábado e domingo devolvem a mesma chave, o que
    // garante um único sync de recuperação no fim de semana inteiro.
    expect(lastClosedSessionKey(utc('2026-09-19T15:00:00Z'))).toBe('2026-09-18');
    expect(lastClosedSessionKey(utc('2026-09-20T23:00:00Z'))).toBe('2026-09-18');
  });

  it('na madrugada de segunda, ainda aponta para a sexta', () => {
    // 2026-09-21 segunda, 06h de Brasília: nada fechou ainda nesta semana.
    expect(lastClosedSessionKey(utc('2026-09-21T09:00:00Z'))).toBe('2026-09-18');
  });
});
