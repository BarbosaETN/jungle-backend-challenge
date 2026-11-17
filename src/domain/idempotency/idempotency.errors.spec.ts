import { IdempotencyConflictError } from './idempotency.errors';

describe('IdempotencyConflictError', () => {
  it('should create an idempotency conflict error', () => {
    const error = new IdempotencyConflictError(
      'Idempotency key was already used with a different payload',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(IdempotencyConflictError);
    expect(error.name).toBe('IdempotencyConflictError');
    expect(error.message).toBe(
      'Idempotency key was already used with a different payload',
    );
  });
});