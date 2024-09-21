import { Options } from "amqplib";
import { BindQueueConfig } from "../types";

export const bindQueue = async (
  config: BindQueueConfig,
  options: Options.AssertQueue = {},
): Promise<void> => {
  const { channel, exchange, logger, queue, topic } = config;

  await channel.assertQueue(queue, { durable: true, ...options });
  await channel.bindQueue(queue, exchange, topic);

  logger.debug("Bound Queue", {
    exchange,
    options,
    queue,
    topic,
  });
};
