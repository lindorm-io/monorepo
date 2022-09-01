import { DomainError } from "../../error";
import { IMessage } from "../../types";
import { IMessageBus, ISubscription, UnsubscribeOptions } from "@lindorm-io/amqp";
import { JOI_MESSAGE, JOI_SUBSCRIPTION } from "../../schema";
import { MessageType } from "../../enum";
import { filter, flatten, isArray, remove } from "lodash";
import { Command, DomainEvent, ErrorMessage, ReplayMessage, TimeoutMessage } from "../../message";

export class MemoryMessageBus implements IMessageBus {
  private subscriptions: Array<ISubscription>;

  public constructor() {
    this.subscriptions = [];
  }

  public async publish(messages: IMessage | Array<IMessage>): Promise<void> {
    const list = isArray(messages) ? messages : [messages];

    for (const message of list) {
      await this.validateMessage(message);

      const subscriptions = filter(this.subscriptions, { topic: message.topic });

      for (const subscription of subscriptions) {
        if (message.delay) {
          setTimeout(
            () =>
              subscription.callback(this.createMessage(message)).catch(() => this.publish(message)),
            message.delay,
          );
        } else {
          subscription.callback(this.createMessage(message)).catch(() => this.publish(message));
        }
      }
    }
  }

  public async subscribe(subscriptions: ISubscription | Array<ISubscription>): Promise<void> {
    const list = isArray(subscriptions) ? subscriptions : [subscriptions];

    for (const subscription of list) {
      await this.validateSubscription(subscription);
    }

    this.subscriptions = flatten([this.subscriptions, list]);
  }

  public async unsubscribe(
    subscriptions: UnsubscribeOptions | Array<UnsubscribeOptions>,
  ): Promise<void> {
    const list = isArray(subscriptions) ? subscriptions : [subscriptions];

    for (const subscription of list) {
      remove(this.subscriptions, subscription);
    }
  }

  public async unsubscribeAll(): Promise<void> {
    this.subscriptions = [];
  }

  private createMessage(
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

      case MessageType.UNKNOWN:
        throw new DomainError("Unknown Message Type");
    }
  }

  private async validateMessage(message: IMessage): Promise<void> {
    await JOI_MESSAGE.validateAsync(message);
  }

  private async validateSubscription(subscription: ISubscription): Promise<void> {
    await JOI_SUBSCRIPTION.validateAsync(subscription);
  }
}
