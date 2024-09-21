import { Constructor } from "@lindorm/types";
import { Connection } from "amqplib";
import { AmqpSourceMessageBusOptions } from "../types";
import { IAmqpMessage } from "./AmqpMessage";

export interface IAmqpSource {
  client: Connection;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  messageBus<M extends IAmqpMessage>(
    Message: Constructor<M>,
    options?: AmqpSourceMessageBusOptions<M>,
  ): void;
}
