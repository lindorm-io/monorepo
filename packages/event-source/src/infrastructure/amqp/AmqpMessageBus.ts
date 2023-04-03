import { DomainError } from "../../error";
import { IAmqpConnection, IMessageBus, ISubscription, MessageBusBase } from "@lindorm-io/amqp";
import { Logger } from "@lindorm-io/core-logger";
import { IMessage } from "../../types";
import { JOI_MESSAGE, JOI_SUBSCRIPTION } from "../../schema";
import { MessageType } from "../../enum";
import { Command, DomainEvent, ErrorMessage, ReplayMessage, TimeoutMessage } from "../../message";

export class AmqpMessageBus extends MessageBusBase<IMessage> implements IMessageBus {
  public constructor(connection: IAmqpConnection, logger: Logger) {
    super(connection, logger);
  }

  protected createMessage(
    message: IMessage,
  ): Command | DomainEvent | ErrorMessage | ReplayMessage | TimeoutMessage {
    switch (message.type) {
      case MessageType.COMMAND:
        return new Command(message);

      case MessageType.DOMAIN_EVENT:
        return new DomainEvent(message);

      case MessageType.ERROR_MESSAGE:
        return new ErrorMessage(message);

      case MessageType.REPLAY_MESSAGE:
        return new ReplayMessage(message);

      case MessageType.TIMEOUT_MESSAGE:
        return new TimeoutMessage(message);

      default:
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
