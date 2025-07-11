import { LindormError } from "@lindorm/errors";
import { IRabbitSubscription, PublishOptions } from "@lindorm/rabbit";
import { DeepPartial } from "@lindorm/types";
import { IHermesMessage, IHermesMessageBus } from "../interfaces";
import { HermesMessageBusOptions } from "../types";

export class MessageBus<M extends IHermesMessage> implements IHermesMessageBus<M> {
  private readonly bus: IHermesMessageBus<M>;

  public constructor(options: HermesMessageBusOptions<M>) {
    if (options.custom) {
      this.bus = options.custom;
    } else if (options.rabbit?.name === "RabbitSource") {
      options.rabbit.addMessages([options.Message]);

      this.bus = options.rabbit.messageBus(options.Message, {
        logger: options.logger,
      });
    } else if (options.redis?.name === "RedisSource") {
      options.redis.addMessages([options.Message]);

      this.bus = options.redis.messageBus(options.Message, {
        logger: options.logger,
      });
    } else {
      throw new LindormError("Invalid MessageBus configuration");
    }
  }

  // public

  public create(options: DeepPartial<M>): M {
    return this.bus.create(options);
  }

  public publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    return this.bus.publish(message, options);
  }

  public subscribe(
    subscription: IRabbitSubscription<M> | Array<IRabbitSubscription<M>>,
  ): Promise<void> {
    return this.bus.subscribe(subscription);
  }
}
