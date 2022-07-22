import { EventEmitterCallback, EventEmitterEvt } from "./event-emitter";
import { Filter, FindOptions } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { MessageBus, ViewStore } from "../infrastructure";
import { View } from "../entity";
import { ViewEventHandler } from "../handler";
import { ViewStoreAttributes, ViewStoreQueryOptions } from "./view-store";

export interface IViewDomain {
  on<State>(evt: EventEmitterEvt, callback: EventEmitterCallback<State>): void;
  query(
    queryOptions: ViewStoreQueryOptions,
    filter: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<View>>;
  registerEventHandler(eventHandler: ViewEventHandler): Promise<void>;
}

export interface ViewDomainOptions {
  logger: Logger;
  messageBus: MessageBus;
  store: ViewStore;
}
