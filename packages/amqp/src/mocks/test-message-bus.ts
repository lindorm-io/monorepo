import { IAmqpConnection, IMessage, ISubscription } from "../types";
import { MessageBusBase } from "../infrastructure";
import { Logger } from "@lindorm-io/core-logger";

export class TestMessageBus extends MessageBusBase {
  public constructor(connection: IAmqpConnection, logger: Logger) {
    super(connection, logger, { nackTimeout: 5000 });
  }

  protected createMessage(message: IMessage): any {
    return message;
  }

  protected async validateMessage(message: IMessage): Promise<void> {
    return;
  }

  protected async validateSubscription(subscription: ISubscription): Promise<void> {
    return;
  }
}
