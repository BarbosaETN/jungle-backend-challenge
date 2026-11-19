export const LOG_EVENTS = {
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_PROCESSED: 'transaction.processed',
  TRANSACTION_FAILED: 'transaction.failed',

  OUTBOX_PUBLISHED: 'outbox.published',
  OUTBOX_PUBLISH_FAILED: 'outbox.publish_failed',

  SQS_MESSAGE_RECEIVED: 'sqs.message_received',
  SQS_MESSAGE_PROCESSED: 'sqs.message_processed',
  SQS_MESSAGE_FAILED: 'sqs.message_failed',
} as const;