import { generatePayloadHash } from './payload-hash';

describe('generatePayloadHash', () => {
  it('should generate a SHA-256 hash with 64 hexadecimal characters', () => {
    const hash = generatePayloadHash({
      providerId: 'provider-1',
      externalTransactionId: 'external-1',
      amount: '10.00',
    });

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should generate the same hash for the same payload', () => {
    const payload = {
      providerId: 'provider-1',
      externalTransactionId: 'external-1',
      amount: '10.00',
    };

    const firstHash = generatePayloadHash(payload);
    const secondHash = generatePayloadHash(payload);

    expect(firstHash).toBe(secondHash);
  });

  it('should generate different hashes for different payloads', () => {
    const firstHash = generatePayloadHash({
      providerId: 'provider-1',
      externalTransactionId: 'external-1',
      amount: '10.00',
    });

    const secondHash = generatePayloadHash({
      providerId: 'provider-1',
      externalTransactionId: 'external-1',
      amount: '20.00',
    });

    expect(firstHash).not.toBe(secondHash);
  });

  it('should generate the same hash regardless of object property order', () => {
    const firstHash = generatePayloadHash({
      providerId: 'provider-1',
      amount: '10.00',
      currency: 'BRL',
    });

    const secondHash = generatePayloadHash({
      currency: 'BRL',
      providerId: 'provider-1',
      amount: '10.00',
    });

    expect(firstHash).toBe(secondHash);
  });
});
