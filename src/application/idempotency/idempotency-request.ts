export interface IdempotencyRequest {
  idempotencyKey: string;
  payload: unknown;
}