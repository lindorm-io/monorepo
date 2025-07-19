import { ILogger } from "@lindorm/logger";
import { IMessage } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";

export type RedisPublisherOptions<M extends IMessage> = {
  client: Redis;
  logger: ILogger;
  target: Constructor<M>;
};
