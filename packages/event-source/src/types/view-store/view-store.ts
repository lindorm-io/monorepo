import { IMessage } from "../message";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { IView, ViewIdentifier } from "../model";
import { View } from "../../model";
import { ViewEventHandlerStoreOptions } from "../handler";
import { ViewStoreAttributes } from "./view-store-attributes";

export type ViewStoreAdapterType = "custom" | "memory" | "mongo" | "postgres";

export interface ViewStoreOptions {
  custom?: IViewStore;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  type: ViewStoreAdapterType;
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
  causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean>;
  clearProcessedCausationIds(saga: IView, options: ViewEventHandlerStoreOptions): Promise<View>;
  load(identifier: ViewIdentifier, options: ViewEventHandlerStoreOptions): Promise<View>;
  processCausationIds(view: IView): Promise<void>;
  save(view: IView, causation: IMessage, options: ViewEventHandlerStoreOptions): Promise<View>;
}

export interface IViewStore {
  causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean>;
  clearProcessedCausationIds(
    filter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    options: ViewEventHandlerStoreOptions,
  ): Promise<void>;
  find(
    identifier: ViewIdentifier,
    options: ViewEventHandlerStoreOptions,
  ): Promise<ViewStoreAttributes | undefined>;
  insert(attributes: ViewStoreAttributes, options: ViewEventHandlerStoreOptions): Promise<void>;
  insertProcessedCausationIds(
    identifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void>;
  update(
    filter: ViewUpdateFilter,
    data: ViewUpdateData,
    options: ViewEventHandlerStoreOptions,
  ): Promise<void>;
}
