import { Aggregate } from "../entity";
import { AmqpConnection } from "@lindorm-io/amqp";
import { CacheRepository, ViewRepository } from "../infrastructure";
import { Data, State } from "./generic";
import { EventEmitterListener } from "./event-emitter";
import { Filter, FindOptions } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import { ReplayOptions } from "./replay-domain";
import { ViewStoreAttributes, ViewStoreQueryOptions } from "./view-store";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  CacheEventHandler,
  SagaEventHandler,
  ViewEventHandler,
} from "../handler";

export interface AppDomain {
  database?: string;
  directory?: string;
  context?: string;
}

export interface AppStructure {
  directory: string;
  include?: Array<RegExp>;
  exclude?: Array<RegExp>;
  extensions?: Array<string>;
}

export interface PrivateAppOptions {
  aggregates?: AppStructure;
  caches?: AppStructure;
  dangerouslyRegisterHandlersManually?: boolean;
  domain?: AppDomain;
  require?: NodeJS.Require;
  sagas?: AppStructure;
  views?: AppStructure;
}

export interface AppOptions extends PrivateAppOptions {
  amqp: AmqpConnection;
  logger: Logger;
  mongo: MongoConnection;
  redis?: RedisConnection;
}

export interface AppPublishOptions {
  aggregate: {
    id: string;
    name: string;
    context?: string;
  };
  name: string;
  data: Record<string, any>;
  delay?: number;
  mandatory?: boolean;
}

export type AppPublishResult = "OK" | "QUEUED";

export interface AppInspectOptions {
  id: string;
  name: string;
  context?: string;
}

export interface CacheRepositoryInfo {
  name: string;
  context: string;
}

export interface ViewRepositoryInfo {
  collection: string;
  context: string;
  name: string;
  replay: string | null;
}

export interface AppAdmin {
  inspect<S = State>(aggregate: AppInspectOptions): Promise<Aggregate<S>>;
  query(
    queryOptions: ViewStoreQueryOptions,
    filter: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<ViewStoreAttributes>>;
  replay(options: ReplayOptions): Promise<void>;
  listCollections(): Promise<Array<string>>;

  registerAggregateCommandHandlers(handlers: Array<AggregateCommandHandler>): Promise<void>;
  registerAggregateEventHandlers(handlers: Array<AggregateEventHandler>): Promise<void>;
  registerCacheEventHandlers(handlers: Array<CacheEventHandler>): Promise<void>;
  registerSagaEventHandlers(handlers: Array<SagaEventHandler>): Promise<void>;
  registerViewEventHandlers(handlers: Array<ViewEventHandler>): Promise<void>;
}

export interface IApp<Caches extends string, Views extends string> {
  publish(options: AppPublishOptions): Promise<AppPublishResult>;
  on<D = Data>(eventName: string, listener: EventEmitterListener<D>): void;
  init(): Promise<void>;

  admin: AppAdmin;

  isInitialised: boolean;
  isReplaying: boolean;

  caches: Record<Caches, CacheRepository>;
  views: Record<Views, ViewRepository>;
}
