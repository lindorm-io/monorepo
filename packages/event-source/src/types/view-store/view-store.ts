import { IMessage } from "../message";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { IView, ViewIdentifier } from "../model";
import { View } from "../../model";
import { ViewEventHandlerAdapter } from "../handler";
import { ViewStoreAttributes } from "./view-store-attributes";

export type ViewStoreAdapterType = "custom" | "memory" | "mongo" | "postgres";

export interface ViewStoreOptions {
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
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
    identifier: ViewIdentifier,
    causation: IMessage,
    adapter: ViewEventHandlerAdapter,
  ): Promise<boolean>;
  clearProcessedCausationIds(saga: IView, adapter: ViewEventHandlerAdapter): Promise<View>;
  load(identifier: ViewIdentifier, adapter: ViewEventHandlerAdapter): Promise<View>;
  processCausationIds(view: IView, adapter: ViewEventHandlerAdapter): Promise<void>;
  save(view: IView, causation: IMessage, adapter: ViewEventHandlerAdapter): Promise<View>;
}

export interface IViewStore {
  causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean>;
  clearProcessedCausationIds(
    filter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    options: ViewEventHandlerAdapter,
  ): Promise<void>;
  find(
    identifier: ViewIdentifier,
    options: ViewEventHandlerAdapter,
  ): Promise<ViewStoreAttributes | undefined>;
  insert(attributes: ViewStoreAttributes, options: ViewEventHandlerAdapter): Promise<void>;
  insertProcessedCausationIds(
    identifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void>;
  update(
    filter: ViewUpdateFilter,
    data: ViewUpdateData,
    options: ViewEventHandlerAdapter,
  ): Promise<void>;
}
