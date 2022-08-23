import { IMessage } from "../message";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { IView, ViewIdentifier } from "../entity";
import { MongoIndex } from "../mongo-base";
import { View } from "../../entity";
import { HandlerIdentifier, ViewEventHandlerAdapters } from "../handler";
import { ViewStoreAttributes } from "./view-store-attributes";

export type ViewStoreAdapterType = "custom" | "memory" | "mongo" | "postgres";

export interface ViewStoreOptions {
  custom?: IViewStore;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  type: ViewStoreAdapterType;
}

export interface ViewStoreInitialiseData {
  view: HandlerIdentifier;
  collection?: string;
  indices?: Array<MongoIndex>;
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
  initialise(data: Array<ViewStoreInitialiseData>): Promise<void>;
  causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean>;
  clearProcessedCausationIds(saga: IView, adapters: ViewEventHandlerAdapters): Promise<View>;
  load(identifier: ViewIdentifier, adapters: ViewEventHandlerAdapters): Promise<View>;
  processCausationIds(view: IView): Promise<void>;
  save(view: IView, causation: IMessage, adapters: ViewEventHandlerAdapters): Promise<View>;
}

export interface IViewStore {
  initialise(data: Array<ViewStoreInitialiseData>): Promise<void>;
  causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean>;
  clearProcessedCausationIds(
    filter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    adapters: ViewEventHandlerAdapters,
  ): Promise<void>;
  find(
    identifier: ViewIdentifier,
    adapters: ViewEventHandlerAdapters,
  ): Promise<ViewStoreAttributes | undefined>;
  insert(attributes: ViewStoreAttributes, adapters: ViewEventHandlerAdapters): Promise<void>;
  insertProcessedCausationIds(
    identifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void>;
  update(
    filter: ViewUpdateFilter,
    data: ViewUpdateData,
    adapters: ViewEventHandlerAdapters,
  ): Promise<void>;
}
