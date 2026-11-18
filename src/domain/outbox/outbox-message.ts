export class OutboxMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutboxMessageError';
  }
}

export class OutboxMessage {
  private constructor(
    private readonly id: string,
    private readonly aggregateId: string,
    private readonly eventType: string,
    private readonly payload: Record<string, unknown>,
    private readonly occurredAt: Date,
    private attempts: number,
    private nextAttemptAt?: Date,
    private publishedAt?: Date,
  ) {}

  static create(
    id: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): OutboxMessage {
    OutboxMessage.validateRequired(id, 'id');
    OutboxMessage.validateRequired(aggregateId, 'aggregateId');
    OutboxMessage.validateRequired(eventType, 'eventType');

    return new OutboxMessage(
      id,
      aggregateId,
      eventType,
      payload,
      new Date(),
      0,
    );
  }

  static restore(
    id: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
    occurredAt: Date,
    attempts: number,
    nextAttemptAt?: Date | null,
    publishedAt?: Date | null,
  ): OutboxMessage {
    OutboxMessage.validateRequired(id, 'id');
    OutboxMessage.validateRequired(aggregateId, 'aggregateId');
    OutboxMessage.validateRequired(eventType, 'eventType');

    if (attempts < 0) {
      throw new OutboxMessageError(
        'Attempts cannot be negative',
      );
    }

    return new OutboxMessage(
      id,
      aggregateId,
      eventType,
      payload,
      occurredAt,
      attempts,
      nextAttemptAt ?? undefined,
      publishedAt ?? undefined,
    );
  }

  markAsPublished(): void {
    if (this.publishedAt) {
      throw new OutboxMessageError(
        'Message is already published',
      );
    }

    this.publishedAt = new Date();
  }

  registerAttempt(nextAttemptAt?: Date): void {
    this.attempts += 1;
    this.nextAttemptAt = nextAttemptAt;
  }

  get messageId(): string {
    return this.id;
  }

  get aggregate(): string {
    return this.aggregateId;
  }

  get type(): string {
    return this.eventType;
  }

  get data(): Record<string, unknown> {
    return this.payload;
  }

  get occurredDate(): Date {
    return this.occurredAt;
  }

  get attemptCount(): number {
    return this.attempts;
  }

  get nextAttemptDate(): Date | undefined {
    return this.nextAttemptAt;
  }

  get publishedDate(): Date | undefined {
    return this.publishedAt;
  }

  get isPublished(): boolean {
    return this.publishedAt !== undefined;
  }

  private static validateRequired(
    value: string,
    field: string,
  ): void {
    if (!value.trim()) {
      throw new OutboxMessageError(
        `${field} cannot be empty`,
      );
    }
  }
}