import { AmqpConnection } from "@lindorm-io/amqp";
import { EventEmitterListener } from "./event-emitter";
import { Filter, FindOptions } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { State } from "./generic";
import { StoreBaseIndex } from "./store-base";
import { CacheRepository, ViewRepository } from "../infrastructure";
import { ViewStoreAttributes, ViewStoreDocumentOptions } from "./view-store";
import { RedisConnection } from "@lindorm-io/redis";
import { AggregateIdentifier } from "./aggregate";
import { Aggregate } from "../entity";

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
  dangerouslyRegisterHandlersManually?: boolean;
  domain?: AppDomain;
  require?: NodeJS.Require;
  sagas?: AppStructure;
  views?: AppStructure;
  caches?: AppStructure;
}

export interface EventDomainAppOptions extends AppOptions {
  amqp: AmqpConnection;
  logger: Logger;
  mongo: MongoConnection;
  redis?: RedisConnection;
}

export interface PublishCommandOptions {
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

export interface InspectAggregateOptions {
  id: string;
  name: string;
  context?: string;
}

export interface CreateCacheRepositoryOptions {
  context?: string;
}

export interface CreateViewRepositoryOptions {
  database?: string;
  collection?: string;
  indices?: Array<StoreBaseIndex>;
  context?: string;
}

export interface IEventDomainApp {
  init(): Promise<void>;
  publish(options: PublishCommandOptions): Promise<void>;
  on<S = State>(eventName: string, listener: EventEmitterListener<S>): void;
  inspect<S = State>(aggregate: AggregateIdentifier): Promise<Aggregate<S>>;
  query(
    documentOptions: ViewStoreDocumentOptions,
    filter: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<ViewStoreAttributes>>;
  createCacheRepository<S = State>(
    name: string,
    options?: CreateCacheRepositoryOptions,
  ): CacheRepository<S>;
  createViewRepository<S = State>(
    name: string,
    options?: CreateViewRepositoryOptions,
  ): ViewRepository<S>;
}
