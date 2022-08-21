import { IMessage } from "../message";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { IView, ViewIdentifier } from "../entity";
import { View } from "../../entity";
import { ViewEventHandlerAdapters } from "../handler";
import { ViewStoreAttributes } from "./view-store-attributes";

export type ViewStoreAdapterType = "custom" | "mongo" | "postgres";

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
  clearProcessedCausationIds(saga: IView, adapterOptions: ViewEventHandlerAdapters): Promise<View>;
  load(identifier: ViewIdentifier, adapterOptions: ViewEventHandlerAdapters): Promise<View>;
  processCausationIds(view: IView): Promise<void>;
  save(view: IView, causation: IMessage, adapterOptions: ViewEventHandlerAdapters): Promise<View>;
}

export interface IViewStore {
  causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean>;
  clearProcessedCausationIds(
    filter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    adapterOptions: ViewEventHandlerAdapters,
  ): Promise<void>;
  find(
    identifier: ViewIdentifier,
    adapterOptions: ViewEventHandlerAdapters,
  ): Promise<ViewStoreAttributes | undefined>;
  insert(attributes: ViewStoreAttributes, adapterOptions: ViewEventHandlerAdapters): Promise<void>;
  insertProcessedCausationIds(
    identifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void>;
  update(
    filter: ViewUpdateFilter,
    data: ViewUpdateData,
    adapterOptions: ViewEventHandlerAdapters,
  ): Promise<void>;
}
