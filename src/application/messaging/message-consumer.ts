export interface MessageConsumer {
  receive(
    queueUrl: string,
    maxMessages: number,
  ): Promise<ReceivedMessage[]>;

  delete(
    queueUrl: string,
    receiptHandle: string,
  ): Promise<void>;
}

export interface ReceivedMessage {
  messageId: string;
  receiptHandle: string;
  body: string;
}