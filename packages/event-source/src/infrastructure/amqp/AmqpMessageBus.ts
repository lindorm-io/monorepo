import { IAmqpConnection, ISubscription, MessageBusBase } from "@lindorm-io/amqp";
import { Command, DomainEvent, ReplayEvent, TimeoutEvent } from "../../message";
import { DomainError } from "../../error";
import { IMessage } from "../../types";
import { JOI_MESSAGE, JOI_SUBSCRIPTION } from "../../schema";
import { ILogger } from "@lindorm-io/winston";
import { MessageType } from "../../enum";

export class AmqpMessageBus extends MessageBusBase<IMessage> {
  public constructor(connection: IAmqpConnection, logger: ILogger) {
    super({ connection, logger });
  }

  protected createMessage(message: IMessage): Command | DomainEvent | ReplayEvent | TimeoutEvent {
    switch (message.type) {
      case MessageType.COMMAND:
        return new Command(message);

      case MessageType.DOMAIN_EVENT:
        return new DomainEvent(message);

      case MessageType.REPLAY_EVENT:
        return new ReplayEvent(message);

      case MessageType.TIMEOUT_EVENT:
        return new TimeoutEvent(message);

      case MessageType.UNKNOWN:
        throw new DomainError("Unknown Message Type");
    }
  }

  protected async validateMessage(message: IMessage): Promise<void> {
    await JOI_MESSAGE.validateAsync(message);
  }

  protected async validateSubscription(subscription: ISubscription): Promise<void> {
    await JOI_SUBSCRIPTION.validateAsync(subscription);
  }
}
