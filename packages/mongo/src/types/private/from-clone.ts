import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { MongoClient } from "mongodb";
import { IMongoFile } from "../../interfaces";

export type FromClone = {
  _mode: "from_clone";
  client: MongoClient;
  database?: string;
  entities: Array<Constructor<IEntity>>;
  files: Array<Constructor<IMongoFile>>;
  logger: ILogger;
  namespace?: string;
};
