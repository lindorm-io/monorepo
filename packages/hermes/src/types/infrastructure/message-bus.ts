import { ILogger } from "@lindorm/logger";
import { IRabbitMessageBus, IRabbitSource } from "@lindorm/rabbit";
import { IHermesMessage } from "../../interfaces";

export type MessageBusOptions = {
  custom?: IRabbitMessageBus<IHermesMessage>;
  rabbit?: IRabbitSource;
};

export type HermesMessageBusOptions = MessageBusOptions & { logger: ILogger };
