import { InboxMessageError } from './inbox-message.errors';

export class InboxMessage {
  private constructor(
    private readonly messageId: string,
    private readonly consumerName: string,
    private readonly payloadHash: string,
    private readonly receivedAt: Date,
    private processedAt?: Date,
  ) {}

  static create(
    messageId: string,
    consumerName: string,
    payloadHash: string,
  ): InboxMessage {
    InboxMessage.validateRequiredFields(
      messageId,
      consumerName,
      payloadHash,
    );

    return new InboxMessage(
      messageId,
      consumerName,
      payloadHash,
      new Date(),
    );
  }

  static restore(
    messageId: string,
    consumerName: string,
    payloadHash: string,
    receivedAt: Date,
    processedAt?: Date,
  ): InboxMessage {
    InboxMessage.validateRequiredFields(
      messageId,
      consumerName,
      payloadHash,
    );

    return new InboxMessage(
      messageId,
      consumerName,
      payloadHash,
      receivedAt,
      processedAt ?? undefined,
    );
  }

  markAsProcessed(): void {
    if (this.processedAt) {
      throw new InboxMessageError(
        'Inbox message has already been processed',
      );
    }

    this.processedAt = new Date();
  }

  get id(): string {
    return this.messageId;
  }

  get consumer(): string {
    return this.consumerName;
  }

  get hash(): string {
    return this.payloadHash;
  }

  get receivedDate(): Date {
    return this.receivedAt;
  }

  get processedDate(): Date | undefined {
    return this.processedAt;
  }

  get isProcessed(): boolean {
    return this.processedAt !== undefined;
  }

  private static validateRequiredFields(
    messageId: string,
    consumerName: string,
    payloadHash: string,
  ): void {
    if (!messageId.trim()) {
      throw new InboxMessageError(
        'Inbox messageId cannot be empty',
      );
    }

    if (!consumerName.trim()) {
      throw new InboxMessageError(
        'Inbox consumerName cannot be empty',
      );
    }

    if (!payloadHash.trim()) {
      throw new InboxMessageError(
        'Inbox payloadHash cannot be empty',
      );
    }
  }
}