import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";

export type FromClone = {
  _mode: "from_clone";
  client: Redis;
  entities: Array<Constructor<IEntity>>;
  logger: ILogger;
  namespace?: string;
};
