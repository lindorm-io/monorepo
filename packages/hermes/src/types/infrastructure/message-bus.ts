import { ILogger } from "@lindorm/logger";
import { IRabbitMessageBus, IRabbitSource } from "@lindorm/rabbit";
import { Constructor } from "@lindorm/types";
import { IHermesMessage } from "../../interfaces";

export type MessageBusOptions<M extends IHermesMessage = IHermesMessage> = {
  custom?: IRabbitMessageBus<M>;
  rabbit?: IRabbitSource;
};

export type HermesMessageBusOptions<M extends IHermesMessage = IHermesMessage> =
  MessageBusOptions<M> & {
    Message: Constructor<M>;
    logger: ILogger;
  };
