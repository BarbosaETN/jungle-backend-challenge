import { Injectable, Logger } from '@nestjs/common';
import { CorrelationIdService } from './correlation-id.service';

export interface LogContext {
  [key: string]: unknown;
}

@Injectable()
export class LoggerService {
  private readonly logger = new Logger();

  constructor(
    private readonly correlationIdService?: CorrelationIdService,
  ) {}

  info(event: string, context: LogContext = {}): void {
    this.logger.log({
      event,
      correlationId: this.correlationIdService?.get(),
      ...context,
    });
  }

  warn(event: string, context: LogContext = {}): void {
    this.logger.warn({
      event,
      correlationId: this.correlationIdService?.get(),
      ...context,
    });
  }

  error(
    event: string,
    context: LogContext = {},
    error?: unknown,
  ): void {
    this.logger.error({
      event,
      correlationId: this.correlationIdService?.get(),
      ...context,
      error: error instanceof Error ? error.message : error,
    });
  }
}