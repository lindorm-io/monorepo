import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { IRedisConnection } from "@lindorm-io/redis";
import { View } from "../../model";
import { ViewEventHandlerAdapter } from "../handler";
import { IMessage } from "../message";
import { IView, ViewIdentifier } from "../model";
import { ViewStoreAttributes } from "./view-store-attributes";

export type ViewStoreAdapterType = "custom" | "memory" | "mongo" | "postgres" | "redis";

export interface ViewStoreOptions {
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  redis?: IRedisConnection;
}

export interface ViewUpdateFilter extends ViewIdentifier {
  hash: string;
  revision: number;
}

export interface ViewUpdateData {
  destroyed: boolean;
  hash: string;
  meta: Record<string, any>;
  processed_causation_ids: Array<string>;
  revision: number;
  state: Record<string, any>;
}

export interface ViewClearProcessedCausationIdsData {
  hash: string;
  processed_causation_ids: Array<string>;
  revision: number;
}

export interface IDomainViewStore {
  causationExists(
    viewIdentifier: ViewIdentifier,
    causation: IMessage,
    adapter: ViewEventHandlerAdapter,
  ): Promise<boolean>;
  clearProcessedCausationIds(view: IView, adapter: ViewEventHandlerAdapter): Promise<View>;
  load(viewIdentifier: ViewIdentifier, adapter: ViewEventHandlerAdapter): Promise<View>;
  processCausationIds(view: IView, adapter: ViewEventHandlerAdapter): Promise<void>;
  save(view: IView, causation: IMessage, adapter: ViewEventHandlerAdapter): Promise<View>;
}

export interface IViewStore {
  causationExists(viewIdentifier: ViewIdentifier, causation: IMessage): Promise<boolean>;
  clearProcessedCausationIds(
    filter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void>;
  find(
    viewIdentifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<ViewStoreAttributes | undefined>;
  insert(attributes: ViewStoreAttributes, adapter: ViewEventHandlerAdapter): Promise<void>;
  insertProcessedCausationIds(
    viewIdentifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void>;
  update(
    filter: ViewUpdateFilter,
    data: ViewUpdateData,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void>;
}
