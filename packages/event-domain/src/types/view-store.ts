import { Filter, FindOptions } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { Message } from "../message";
import { MongoConnection } from "@lindorm-io/mongo";
import { StoreBaseIndex } from "./store-base";
import { View } from "../entity";
import { ViewData, ViewIdentifier } from "./view";

export interface ViewStoreAttributes extends ViewData {
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
  save(view: View, causation: Message, options: ViewStoreDocumentOptions): Promise<View>;
  load(viewIdentifier: ViewIdentifier, options: ViewStoreDocumentOptions): Promise<View>;
  query<State extends Record<string, any> = Record<string, any>>(
    queryOptions: ViewStoreQueryOptions,
    filter: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<View<State>>>;
}
