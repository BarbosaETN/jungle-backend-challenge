import { generateIdempotencyPayloadHash } from './idempotency-request-hash';

describe('generateIdempotencyPayloadHash', () => {
  it('should generate the hash from the request payload', () => {
    const request = {
      idempotencyKey: 'idempotency-123',
      payload: {
        providerId: 'provider-1',
        externalTransactionId: 'external-1',
        amount: '10.00',
      },
    };

    const hash = generateIdempotencyPayloadHash(request);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should ignore the idempotency key when generating the payload hash', () => {
    const firstRequest = {
      idempotencyKey: 'key-1',
      payload: {
        providerId: 'provider-1',
        amount: '10.00',
      },
    };

    const secondRequest = {
      idempotencyKey: 'key-2',
      payload: {
        providerId: 'provider-1',
        amount: '10.00',
      },
    };

    expect(generateIdempotencyPayloadHash(firstRequest)).toBe(
      generateIdempotencyPayloadHash(secondRequest),
    );
  });
});