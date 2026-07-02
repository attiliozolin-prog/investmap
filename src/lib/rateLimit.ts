/**
 * Rate limiter em memória por chave (ex.: user id).
 *
 * Limitação conhecida: em ambiente serverless cada instância tem sua
 * própria memória, então o limite real pode ser N × maxRequests.
 * Suficiente para conter abuso em escala de beta; trocar por armazenamento
 * durável (tabela no Supabase ou Upstash) se o app escalar.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Evita crescimento sem limite da Map em instâncias de vida longa
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) buckets.clear();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter(t => now - t < windowMs);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000),
    };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - bucket.timestamps.length,
    retryAfterSeconds: 0,
  };
}
