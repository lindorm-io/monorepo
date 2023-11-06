import { Logger } from "@lindorm-io/core-logger";
import { MessageBusBase } from "../infrastructure";
import { IAmqpConnection, IMessage } from "../types";

export class TestMessageBus extends MessageBusBase {
  public constructor(connection: IAmqpConnection, logger: Logger) {
    super(connection, logger, { nackTimeout: 5000 });
  }

  protected createMessage(message: IMessage): any {
    return message;
  }

  protected async validateMessage(): Promise<void> {
    return;
  }

  protected async validateSubscription(): Promise<void> {
    return;
  }
}
