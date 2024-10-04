import { ILogger } from "@lindorm/logger";
import {
  IRabbitMessageBus,
  IRabbitSource,
  IRabbitSubscription,
  UnsubscribeOptions,
} from "@lindorm/rabbit";
import { DeepPartial } from "@lindorm/types";
import { DomainError } from "../../errors";
import { IHermesMessage } from "../../interfaces";
import { HermesCommand, HermesError, HermesEvent, HermesTimeout } from "../../messages";
import { HermesMessage } from "../../messages/HermesMessage";
import { HermesErrorData, HermesMessageOptions } from "../../types";

export class HermesRabbitMessageBus implements IRabbitMessageBus<HermesMessage> {
  private readonly messageBus: IRabbitMessageBus<HermesMessage>;

  public constructor(source: IRabbitSource, logger: ILogger) {
    source.addMessages([HermesMessage]);

    this.messageBus = source.messageBus(HermesMessage, {
      logger,
      create: this.createFn.bind(this),
    });
  }

  // public

  public create(options: HermesMessageOptions | HermesMessage): HermesMessage {
    return this.messageBus.create(options);
  }

  public publish(message: HermesMessage | Array<HermesMessage>): Promise<void> {
    return this.messageBus.publish(message);
  }

  public subscribe(
    subscription:
      | IRabbitSubscription<HermesMessage>
      | Array<IRabbitSubscription<HermesMessage>>,
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

  // private

  private createFn(message: DeepPartial<IHermesMessage>): IHermesMessage {
    switch (message.type) {
      case HermesCommand.name:
        return new HermesCommand(message as HermesMessageOptions);

      case HermesError.name:
        return new HermesError(message as HermesMessageOptions<HermesErrorData>);

      case HermesEvent.name:
        return new HermesEvent(message as HermesMessageOptions);

      case HermesTimeout.name:
        return new HermesTimeout(message as HermesMessageOptions);

      default:
        throw new DomainError("Unsupported message type", {
          data: { type: message.type },
        });
    }
  }
}
