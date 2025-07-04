import { LindormError } from "@lindorm/errors";
import { IRabbitSubscription, PublishOptions, UnsubscribeOptions } from "@lindorm/rabbit";
import { DeepPartial } from "@lindorm/types";
import { IHermesMessage, IHermesMessageBus } from "../interfaces";
import { HermesMessageBusOptions } from "../types";

export class MessageBus<M extends IHermesMessage> implements IHermesMessageBus<M> {
  private readonly messageBus: IHermesMessageBus<M>;

  public constructor(options: HermesMessageBusOptions<M>) {
    if (options.custom) {
      this.messageBus = options.custom;
    } else if (options.rabbit?.name === "RabbitSource") {
      options.rabbit.addMessages([options.Message]);

      this.messageBus = options.rabbit.messageBus(options.Message, {
        logger: options.logger,
      });
    } else {
      throw new LindormError("Invalid MessageBus configuration");
    }
  }

  // public

  public create(options: DeepPartial<M>): M {
    return this.messageBus.create(options);
  }

  public publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    return this.messageBus.publish(message, options);
  }

  public subscribe(
    subscription: IRabbitSubscription<M> | Array<IRabbitSubscription<M>>,
  ): Promise<void> {
    return this.messageBus.subscribe(subscription);
  }

  public unsubscribe(
    subscription: UnsubscribeOptions | Array<UnsubscribeOptions>,
  ): Promise<void> {
    return this.messageBus.unsubscribe(subscription);
  }

  public unsubscribeAll(): Promise<void> {
    return this.messageBus.unsubscribeAll();
  }
}
