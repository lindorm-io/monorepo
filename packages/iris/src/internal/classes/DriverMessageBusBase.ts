import type { IIrisMessageBus, IMessage } from "../../interfaces/index.js";
import type { PublishOptions, SubscribeOptions } from "../../types/index.js";
import { DriverBase } from "./DriverBase.js";
import type { DriverBaseOptions } from "./DriverBase.js";

export type DriverMessageBusBaseOptions<M extends IMessage> = DriverBaseOptions<M>;

export abstract class DriverMessageBusBase<M extends IMessage>
  extends DriverBase<M>
  implements IIrisMessageBus<M>
{
  protected constructor(options: DriverMessageBusBaseOptions<M>) {
    super(options, "MessageBus");
  }

  abstract publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;

  abstract subscribe(
    options: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
  ): Promise<void>;

  abstract unsubscribe(options: { topic: string; queue?: string }): Promise<void>;

  abstract unsubscribeAll(): Promise<void>;
}
