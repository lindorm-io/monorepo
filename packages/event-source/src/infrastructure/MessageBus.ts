import { AmqpMessageBus } from "./amqp";
import { Logger } from "@lindorm-io/core-logger";
import { IMessageBus, IMessage, ISubscription, UnsubscribeOptions } from "@lindorm-io/amqp";
import { MemoryMessageBus } from "./memory";
import { MessageBusOptions } from "../types/message-bus";
import { MessageBusType } from "../enum";

export class MessageBus implements IMessageBus {
  private readonly bus: IMessageBus;

  public constructor(options: MessageBusOptions, logger: Logger) {
    switch (options.type) {
      case MessageBusType.AMQP:
        if (!options.amqp) throw new Error("Connection not provided");
        this.bus = new AmqpMessageBus(options.amqp, logger);
        break;

      case MessageBusType.CUSTOM:
        if (!options.custom) throw new Error("IMessageBus not provided");
        this.bus = options.custom;
        break;

      case MessageBusType.MEMORY:
        this.bus = new MemoryMessageBus();
        break;

      default:
        throw new Error("Invalid MessageBus type");
    }
  }

  public publish(messages: Array<IMessage> | IMessage): Promise<void> {
    return this.bus.publish(messages);
  }

  public subscribe(subscriptions: Array<ISubscription> | ISubscription): Promise<void> {
    return this.bus.subscribe(subscriptions);
  }

  public unsubscribe(subscriptions: UnsubscribeOptions | Array<UnsubscribeOptions>): Promise<void> {
    return this.bus.unsubscribe(subscriptions);
  }

  public unsubscribeAll(): Promise<void> {
    return this.bus.unsubscribeAll();
  }
}
