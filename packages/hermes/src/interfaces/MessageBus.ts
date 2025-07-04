/* eslint-disable @typescript-eslint/no-empty-object-type */

import { IRabbitMessageBus } from "@lindorm/rabbit";
import { IHermesMessage } from "./HermesMessage";

export interface IHermesMessageBus<M extends IHermesMessage = IHermesMessage>
  extends IRabbitMessageBus<M> {}
