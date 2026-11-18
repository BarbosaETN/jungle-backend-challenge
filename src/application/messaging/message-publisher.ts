export interface MessagePublisher {
  publish(
    queueUrl: string,
    message: string,
  ): Promise<void>;
}