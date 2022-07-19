import { ConfirmChannel, Connection, Options } from "amqplib";
import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";

export interface IAmqpConnection extends IConnectionBase<Connection> {
  bindQueue(queue: string, routingKey: string, options?: Options.AssertQueue): Promise<void>;

  channel: ConfirmChannel;
  deadLetters: string;
  exchange: string;
}

export interface ExtendedConnectOptions extends Options.Connect {
  deadLetters?: string;
  exchange?: string;
}

export type AmqpConnectionOptions = ConnectionBaseOptions<Options.Connect> & ExtendedConnectOptions;
