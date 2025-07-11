import { ILogger } from "@lindorm/logger";
import Redis from "ioredis";

export type DelayedMessageWorkerOptions = {
  client: Redis;
  logger: ILogger;
};
