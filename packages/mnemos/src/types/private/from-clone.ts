import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { IMnemosCache } from "../../interfaces";

export type FromClone = {
  _mode: "from_clone";
  client: IMnemosCache;
  entities: Array<Constructor<IEntity>>;
  logger: ILogger;
};
