import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;

    return Object.keys(object)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalize(object[key]);
        return result;
      }, {});
  }

  return value;
}

export function generatePayloadHash(payload: unknown): string {
  const canonicalPayload = canonicalize(payload);
  const serializedPayload = JSON.stringify(canonicalPayload);

  return createHash('sha256')
    .update(serializedPayload)
    .digest('hex');
}