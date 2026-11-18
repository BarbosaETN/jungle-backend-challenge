export class WalletConcurrencyError extends Error {
  constructor(walletId: string, expectedVersion: number) {
    super(
      `Wallet version conflict: wallet ${walletId} expected version ${expectedVersion}`,
    );

    this.name = 'WalletConcurrencyError';
  }
}