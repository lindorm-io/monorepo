import { Command, DomainEvent, TimeoutEvent } from "../message";
import { DomainError } from "../error";
import { IMessage } from "../types";
import { ISubscription, MessageBusBase, MessageBusOptions } from "@lindorm-io/amqp";
import { MessageType } from "../enum";
import { JOI_MESSAGE, JOI_SUBSCRIPTION } from "../constant";

export class MessageBus extends MessageBusBase<IMessage> {
  public constructor(options: MessageBusOptions) {
    super(options);
  }

  protected createMessage(message: IMessage): Command | DomainEvent | TimeoutEvent {
    switch (message.type) {
      case MessageType.COMMAND:
        return new Command(message);

      case MessageType.DOMAIN_EVENT:
        return new DomainEvent(message);

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
