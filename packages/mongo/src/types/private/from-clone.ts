import { ILogger } from "@lindorm/logger";
import { MongoClient } from "mongodb";
import { MongoSourceEntity, MongoSourceFile } from "../mongo-source";

export type FromClone = {
  _mode: "from_clone";
  client: MongoClient;
  database: string;
  entities: Array<MongoSourceEntity>;
  files: Array<MongoSourceFile>;
  logger: ILogger;
  namespace: string | undefined;
};
