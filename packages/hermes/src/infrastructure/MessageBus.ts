import { LindormError } from "@lindorm/errors";
import { IRabbitMessageBus, IRabbitSubscription, RabbitSource } from "@lindorm/rabbit";
import { IHermesMessage, IHermesMessageBus } from "../interfaces";
import { HermesMessageBase } from "../messages/HermesMessageBase";
import { HermesMessageBusOptions } from "../types";
import { HermesRabbitMessageBus } from "./rabbit";

export class MessageBus implements IHermesMessageBus {
  private readonly messageBus: IRabbitMessageBus<IHermesMessage>;

  public constructor(options: HermesMessageBusOptions) {
    if (options.custom) {
      this.messageBus = options.custom;
    } else if (options.rabbit instanceof RabbitSource) {
      this.messageBus = new HermesRabbitMessageBus(options.rabbit, options.logger);
    } else {
      throw new LindormError("Invalid MessageBus configuration");
    }
  }

  // public

  public publish(message: HermesMessageBase | Array<HermesMessageBase>): Promise<void> {
    return this.messageBus.publish(message);
  }

  public subscribe(
    subscription:
      | IRabbitSubscription<HermesMessageBase>
      | Array<IRabbitSubscription<HermesMessageBase>>,
  ): Promise<void> {
    return this.messageBus.subscribe(subscription);
  }
}
