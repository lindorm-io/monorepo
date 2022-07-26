import { DomainEvent } from "../message";
import { Filter, FindOptions } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { State } from "./generic";
import { StoreBaseIndex } from "./store-base";
import { View } from "../entity";
import { ViewData, ViewIdentifier } from "./view";

export interface ViewStoreAttributes<S extends State = State> extends ViewData<S> {
  timeModified: Date;
  timestamp: Date;
}

export interface ViewStoreOptions {
  connection: MongoConnection;
  database?: string;
  logger: Logger;
}

export interface ViewStoreCollectionOptions {
  collection: string;
  database?: string;
  indices?: Array<StoreBaseIndex>;
}

export interface ViewStoreDocumentOptions {
  collection?: string;
  database?: string;
  indices?: Array<StoreBaseIndex>;
}

export type ViewStoreQueryOptions = ViewStoreCollectionOptions;

export interface IViewStore {
  save(view: View, causation: DomainEvent, options: ViewStoreDocumentOptions): Promise<View>;
  load(viewIdentifier: ViewIdentifier, options: ViewStoreDocumentOptions): Promise<View>;
  query(
    queryOptions: ViewStoreQueryOptions,
    filter?: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<ViewStoreAttributes>>;

  listCollections(): Promise<Array<string>>;
  renameCollection(collection: string, name: string): Promise<void>;
  dropCollection(collection: string): Promise<void>;
}
