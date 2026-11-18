import { MessageHandler } from '../../application/workers/message-handler';

export class LoggingMessageHandler implements MessageHandler {
  async handle(message: {
    messageId: string;
    body: string;
  }): Promise<void> {
    console.log(
      `[MessageHandler] Processing message ${message.messageId}`,
    );

    console.log(message.body);
  }
}