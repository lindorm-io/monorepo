/* eslint-disable @typescript-eslint/no-empty-object-type */

import { IRabbitSubscription, PublishOptions } from "@lindorm/rabbit";
import { DeepPartial } from "@lindorm/types";
import { IHermesMessage } from "./HermesMessage";

export interface IHermesMessageBus<M extends IHermesMessage = IHermesMessage> {
  create(options: DeepPartial<M>): M;
  publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;
  subscribe(
    subscription: IRabbitSubscription<M> | Array<IRabbitSubscription<M>>,
  ): Promise<void>;
}
