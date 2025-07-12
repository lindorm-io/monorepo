/* eslint-disable @typescript-eslint/no-empty-object-type */

import { SubscribeOptions } from "@lindorm/message";
import { DeepPartial } from "@lindorm/types";
import { IHermesMessage } from "./HermesMessage";

export type PublishOptions = {
  delay?: number;
};

export interface IHermesMessageBus<M extends IHermesMessage = IHermesMessage> {
  create(options: DeepPartial<M>): M;
  publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;
  subscribe(
    subscription: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
  ): Promise<void>;
}
