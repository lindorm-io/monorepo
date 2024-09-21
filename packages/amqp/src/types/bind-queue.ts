import { ILogger } from "@lindorm/logger";
import { ConfirmChannel } from "amqplib";

export type BindQueueConfig = {
  channel: ConfirmChannel;
  exchange: string;
  logger: ILogger;
  queue: string;
  topic: string;
};
