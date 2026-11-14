import crypto from 'crypto';

/**
 * Performs a constant-time comparison of two strings to prevent timing side-channel attacks.
 */
export function timingSafeEqualString(a?: string | null, b?: string | null): boolean {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  if (bufA.length !== bufB.length) {
    // Perform dummy comparison on identical buffer to equalize execution time
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}
