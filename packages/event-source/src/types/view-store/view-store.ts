import { IMessage } from "../message";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { IRedisConnection } from "@lindorm-io/redis";
import { IView, ViewIdentifier } from "../model";
import { MongoViewStoreHandlerOptions } from "./view-store-mongo";
import { PostgresViewStoreHandlerOptions } from "./view-store-postgres";
import { RedisViewStoreHandlerOptions } from "./view-store-redis";
import { View } from "../../model";

export type ViewStorePersistence = "custom" | "mongo" | "postgres" | "redis";

export interface ViewStoreOptions {
  custom?: IViewStore;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  redis?: IRedisConnection;
}

export interface ViewStoreHandlerOptions {
  custom?: Record<string, any>;
  mongo?: MongoViewStoreHandlerOptions;
  postgres?: PostgresViewStoreHandlerOptions;
  redis?: RedisViewStoreHandlerOptions;
  type: ViewStorePersistence;
}

export interface IViewStore {
  save(view: IView, causation: IMessage, handlerOptions: ViewStoreHandlerOptions): Promise<View>;
  load(identifier: ViewIdentifier, handlerOptions: ViewStoreHandlerOptions): Promise<View>;
}
