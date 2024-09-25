import { Constructor } from "@lindorm/types";
import { Connection } from "amqplib";
import { CloneRabbitSourceOptions, RabbitSourceMessageBusOptions } from "../types";
import { IRabbitMessage } from "./RabbitMessage";

export interface IRabbitSource {
  client: Connection;

  clone(options?: CloneRabbitSourceOptions): IRabbitSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  messageBus<M extends IRabbitMessage>(
    Message: Constructor<M>,
    options?: RabbitSourceMessageBusOptions<M>,
  ): void;
}
