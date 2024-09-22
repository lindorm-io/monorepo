import { Constructor } from "@lindorm/types";
import { Connection } from "amqplib";
import { RabbitSourceMessageBusOptions } from "../types";
import { IRabbitMessage } from "./RabbitMessage";

export interface IRabbitSource {
  client: Connection;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  messageBus<M extends IRabbitMessage>(
    Message: Constructor<M>,
    options?: RabbitSourceMessageBusOptions<M>,
  ): void;
}
