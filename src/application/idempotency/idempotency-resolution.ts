import type { WagerTransaction } from '../../domain/wager-transaction/wager-transaction';

export type IdempotencyResolution =
  | {
      type: 'NEW';
    }
  | {
      type: 'REPLAY';
      transaction: WagerTransaction;
    }
  | {
      type: 'CONFLICT';
    };