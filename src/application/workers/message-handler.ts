export interface MessageHandler {
  handle(message: {
    messageId: string;
    body: string;
  }): Promise<void>;
}