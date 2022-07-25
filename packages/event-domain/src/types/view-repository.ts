import { MongoConnection } from "@lindorm-io/mongo";
import { StoreBaseIndex } from "./store-base";
import { Logger } from "@lindorm-io/winston";
import { HandlerIdentifier } from "./handler";

export interface ViewRepositoryOptions {
  collection?: string;
  connection: MongoConnection;
  database?: string;
  indices?: Array<StoreBaseIndex>;
  logger: Logger;
  view: HandlerIdentifier;
}

export interface ViewRepositoryData<S> {
  id: string;
  revision: number;
  state: S;
  timeModified: Date;
}
