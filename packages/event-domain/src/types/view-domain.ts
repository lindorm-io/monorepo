import { EventEmitterListener } from "./event-emitter";
import { Filter, FindOptions } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { MessageBus, ViewStore } from "../infrastructure";
import { State } from "./generic";
import { ViewEventHandler } from "../handler";
import { ViewStoreAttributes, ViewStoreQueryOptions } from "./view-store";

export interface ViewDomainOptions {
  logger: Logger;
  messageBus: MessageBus;
  store: ViewStore;
}

export interface IViewDomain {
  on<S = State>(eventName: string, listener: EventEmitterListener<S>): void;
  query(
    queryOptions: ViewStoreQueryOptions,
    filter: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<ViewStoreAttributes>>;

  registerEventHandler(eventHandler: ViewEventHandler): Promise<void>;
  removeEventHandler(eventHandler: ViewEventHandler): Promise<void>;
  removeAllEventHandlers(): Promise<void>;

  listCollections(): Promise<Array<string>>;
}
