import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  it('should log an info event', () => {
    const logger = new LoggerService();

    expect(() => {
      logger.info('transaction.processed', {
        transactionId: 'tx-123',
        walletId: 'wallet-456',
      });
    }).not.toThrow();
  });

  it('should log a warning event', () => {
    const logger = new LoggerService();

    expect(() => {
      logger.warn('transaction.retrying', {
        transactionId: 'tx-123',
      });
    }).not.toThrow();
  });

  it('should log an error event', () => {
    const logger = new LoggerService();

    expect(() => {
      logger.error(
        'transaction.failed',
        {
          transactionId: 'tx-123',
        },
        new Error('Something went wrong'),
      );
    }).not.toThrow();
  });
});