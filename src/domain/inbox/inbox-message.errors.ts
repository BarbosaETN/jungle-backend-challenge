export class InboxMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InboxMessageError';
  }
}