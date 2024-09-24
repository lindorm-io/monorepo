import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Connection } from "amqplib";
import { RabbitSourceMessageBusOptions } from "../types";
import { IRabbitMessage } from "./RabbitMessage";

export interface IRabbitSource {
  client: Connection;

  clone(logger?: ILogger): IRabbitSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  messageBus<M extends IRabbitMessage>(
    Message: Constructor<M>,
    options?: RabbitSourceMessageBusOptions<M>,
  ): void;
}
