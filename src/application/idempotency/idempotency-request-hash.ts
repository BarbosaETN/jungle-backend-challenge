import { generatePayloadHash } from './payload-hash';
import type { IdempotencyRequest } from './idempotency-request';

export function generateIdempotencyPayloadHash(
  request: IdempotencyRequest,
): string {
  return generatePayloadHash(request.payload);
}
