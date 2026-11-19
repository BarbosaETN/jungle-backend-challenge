import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { CorrelationIdService } from './correlation-id.service';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    private readonly correlationIdService: CorrelationIdService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      req.header('X-Correlation-ID') ?? randomUUID();

    res.setHeader('X-Correlation-ID', correlationId);

    this.correlationIdService.run(correlationId, () => {
      next();
    });
  }
}