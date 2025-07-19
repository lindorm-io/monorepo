import { ILogger } from "@lindorm/logger";
import { IMessage } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { ConfirmChannel } from "amqplib";

export type RabbitPublisherOptions<M extends IMessage> = {
  channel: ConfirmChannel;
  exchange: string;
  logger: ILogger;
  target: Constructor<M>;
};
