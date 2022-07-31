import { IMessage } from "../message";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { IRedisConnection } from "@lindorm-io/redis";
import { IView, ViewIdentifier } from "../view";
import { MongoViewStoreHandlerOptions } from "./view-store-mongo";
import { RedisViewStoreHandlerOptions } from "./view-store-redis";
import { View } from "../../entity";
import { PostgresViewStoreHandlerOptions } from "./view-store-postgres";

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
  type: "custom" | "mongo" | "postgres" | "redis";
}

export interface IViewStore {
  save(view: IView, causation: IMessage, handlerOptions: ViewStoreHandlerOptions): Promise<View>;
  load(identifier: ViewIdentifier, handlerOptions: ViewStoreHandlerOptions): Promise<View>;
}
