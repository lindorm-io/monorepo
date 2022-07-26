import { Aggregate } from "../entity";
import { AggregateIdentifier } from "./aggregate";
import { AmqpConnection } from "@lindorm-io/amqp";
import { CacheRepository, ViewRepository } from "../infrastructure";
import { EventEmitterListener } from "./event-emitter";
import { Filter, FindOptions } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import { ReplayOptions } from "./replay-domain";
import { State } from "./generic";
import { StoreBaseIndex } from "./store-base";
import { ViewStoreAttributes, ViewStoreQueryOptions } from "./view-store";

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

export interface AppOptions {
  aggregates?: AppStructure;
  caches?: AppStructure;
  dangerouslyRegisterHandlersManually?: boolean;
  domain?: AppDomain;
  require?: NodeJS.Require;
  sagas?: AppStructure;
  views?: AppStructure;
}

export interface EventDomainAppOptions extends AppOptions {
  amqp: AmqpConnection;
  logger: Logger;
  mongo: MongoConnection;
  redis?: RedisConnection;
}

export interface PublishOptions {
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

export type PublishResult = "OK" | "QUEUED";

export interface InspectAggregateOptions {
  id: string;
  name: string;
  context?: string;
}

export interface CreateCacheRepositoryOptions {
  context?: string;
}

export interface CreateViewRepositoryOptions {
  collection?: string;
  database?: string;
  indices?: Array<StoreBaseIndex>;
  context?: string;
}

export interface IEventDomainApp {
  createCacheRepository<S = State>(
    name: string,
    options?: CreateCacheRepositoryOptions,
  ): CacheRepository<S>;
  createViewRepository<S = State>(
    name: string,
    options?: CreateViewRepositoryOptions,
  ): ViewRepository<S>;
  init(): Promise<void>;
  inspect<S = State>(aggregate: AggregateIdentifier): Promise<Aggregate<S>>;
  on<S = State>(eventName: string, listener: EventEmitterListener<S>): void;
  publish(options: PublishOptions): Promise<PublishResult>;
  query(
    queryOptions: ViewStoreQueryOptions,
    filter: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<ViewStoreAttributes>>;
  replay(options: ReplayOptions): Promise<void>;
  views(): Promise<Array<string>>;

  isInitialised: boolean;
  isReplaying: boolean;
}
