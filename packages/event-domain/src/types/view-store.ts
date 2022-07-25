import { DomainEvent } from "../message";
import { Filter, FindOptions } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { StoreBaseIndex } from "./store-base";
import { View } from "../entity";
import { ViewData, ViewIdentifier } from "./view";
import { State } from "./generic";

export interface ViewStoreAttributes<S extends State = State> extends ViewData<S> {
  timeModified: Date;
  timestamp: Date;
}

export interface ViewStoreOptions {
  connection: MongoConnection;
  database?: string;
  logger: Logger;
}

export interface ViewStoreQueryOptions {
  collection: string;
  database?: string;
}

export interface ViewStoreDocumentOptions extends ViewStoreQueryOptions {
  indices?: Array<StoreBaseIndex>;
}

export interface IViewStore {
  save(view: View, causation: DomainEvent, options: ViewStoreDocumentOptions): Promise<View>;
  load(viewIdentifier: ViewIdentifier, options: ViewStoreDocumentOptions): Promise<View>;
  query(
    queryOptions: ViewStoreQueryOptions,
    filter: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<ViewStoreAttributes>>;
}
