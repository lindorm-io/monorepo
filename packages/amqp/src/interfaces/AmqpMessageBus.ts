import { DeepPartial } from "@lindorm/types";
import { UnsubscribeOptions } from "../types";
import { IAmqpMessage } from "./AmqpMessage";
import { IAmqpSubscription } from "./AmqpSubscription";

export interface IAmqpMessageBus<
  M extends IAmqpMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> {
  create(options: O | M): M;
  publish(message: M | Array<M>): Promise<void>;
  subscribe(
    subscription: IAmqpSubscription<M> | Array<IAmqpSubscription<M>>,
  ): Promise<void>;
  unsubscribe(
    subscription: UnsubscribeOptions | Array<UnsubscribeOptions>,
  ): Promise<void>;
  unsubscribeAll(): Promise<void>;
}
