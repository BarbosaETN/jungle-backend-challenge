import type { Currency } from '../money/currency';
import type { WagerTransactionKind } from '../wager-transaction/wager-transaction-kind';

export interface MoneyProps {
  amount: string;
  currency: Currency;
}

export interface WagerTransactionProcessedData {
  transactionId: string;
  walletId: string;
  playerId: string;
  externalTransactionId: string;
  providerId: string;
  kind: WagerTransactionKind;
  amount: MoneyProps;
  currency: Currency;
  balanceBefore: MoneyProps;
  balanceAfter: MoneyProps;
}

export interface WagerTransactionRejectedData {
  transactionId: string;
  walletId: string;
  playerId: string;
  externalTransactionId: string;
  providerId: string;
  kind: WagerTransactionKind;
  amount: MoneyProps;
  currency: Currency;
  failureCode: string;
}

export interface WagerTransactionPendingReferenceData {
  transactionId: string;
  walletId: string;
  playerId: string;
  externalTransactionId: string;
  providerId: string;
  kind: WagerTransactionKind;
  amount: MoneyProps;
  currency: Currency;
  referenceExternalTransactionId: string;
}

export interface WalletBalanceChangedData {
  walletId: string;
  transactionId: string;
  direction: 'CREDIT' | 'DEBIT';
  money: MoneyProps;
  balanceBefore: MoneyProps;
  balanceAfter: MoneyProps;
  walletVersion: number;
}
