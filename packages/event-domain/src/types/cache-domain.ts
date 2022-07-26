import { EventEmitterListener } from "./event-emitter";
import { Logger } from "@lindorm-io/winston";
import { MessageBus, CacheStore } from "../infrastructure";
import { State } from "./generic";
import { CacheEventHandler } from "../handler";

export interface CacheDomainOptions {
  logger: Logger;
  messageBus: MessageBus;
  store: CacheStore;
}

export interface ICacheDomain {
  on<S = State>(eventName: string, listener: EventEmitterListener<S>): void;
  registerEventHandler(eventHandler: CacheEventHandler): Promise<void>;
  removeEventHandler(eventHandler: CacheEventHandler): Promise<void>;
  removeAllEventHandlers(): Promise<void>;
}
