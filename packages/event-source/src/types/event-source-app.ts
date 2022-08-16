import { Aggregate, Saga } from "../entity";
import { Data, State } from "./generic";
import { EventEmitterListener } from "./event-emitter";
import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";
import { EventStorePersistence, IEventStore } from "./event-store";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { IRedisConnection } from "@lindorm-io/redis";
import { ISagaStore, SagaStorePersistence } from "./saga-store";
import { IViewStore } from "./view-store";
import { ReplayOptions } from "./replay-domain";
import {
  MongoViewRepository,
  PostgresViewRepository,
  RedisViewRepository,
  ViewEntity,
} from "../infrastructure";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  SagaEventHandler,
  ViewEventHandler,
} from "../handler";
import { MessageBusQueue } from "./message-bus";

export interface AppDomain {
  directory?: string;
  context?: string;
}

export interface AppStructure {
  directory?: string;
  include?: Array<RegExp>;
  exclude?: Array<RegExp>;
  extensions?: Array<string>;
}

export interface AggregateStructure extends AppStructure {
  persistence?: EventStorePersistence;
}

export interface SagaStructure extends AppStructure {
  persistence?: SagaStorePersistence;
}

export type ViewStructure = AppStructure;

export interface MessageBusStructure {
  queue?: MessageBusQueue;
}

export interface PrivateAppOptions {
  aggregates?: AggregateStructure;
  messageBus?: MessageBusStructure;
  dangerouslyRegisterHandlersManually?: boolean;
  domain?: AppDomain;
  require?: NodeJS.Require;
  sagas?: SagaStructure;
  views?: ViewStructure;
}

export interface AppOptions extends PrivateAppOptions {
  amqp?: IAmqpConnection;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  redis?: IRedisConnection;
  custom?: {
    messageBus?: IMessageBus;
    eventStore?: IEventStore;
    sagaStore?: ISagaStore;
    viewStore?: IViewStore;
  };
}

export interface AppPublishOptions {
  aggregate: {
    id: string;
    name: string;
    context?: string;
  };
  name: string;
  data: Record<string, any>;
  correlationId?: string;
  delay?: number;
  mandatory?: boolean;
  origin?: string;
  originator?: string | null;
}

export type AppPublishResult = "OK" | "QUEUED";

export interface AppInspectOptions {
  id: string;
  name: string;
  context?: string;
}

export interface AppAdmin {
  inspect: {
    aggregate<S = State>(aggregate: AppInspectOptions): Promise<Aggregate<S>>;
    saga<S = State>(saga: AppInspectOptions): Promise<Saga<S>>;
  };
  replay(options: ReplayOptions): Promise<void>;
}

export interface AppRepositories {
  mongo<S>(name: string, collection?: string): MongoViewRepository<S>;
  postgres<S>(name: string, entity?: typeof ViewEntity): PostgresViewRepository<S>;
  redis<S>(name: string): RedisViewRepository<S>;
}

export interface AppSetup {
  registerAggregateCommandHandlers(handlers: Array<AggregateCommandHandler>): Promise<void>;
  registerAggregateEventHandlers(handlers: Array<AggregateEventHandler>): Promise<void>;
  registerSagaEventHandlers(handlers: Array<SagaEventHandler>): Promise<void>;
  registerViewEventHandlers(handlers: Array<ViewEventHandler>): Promise<void>;
}

export interface IEventSource {
  publish(options: AppPublishOptions): Promise<AppPublishResult>;
  on<D = Data>(eventName: string, listener: EventEmitterListener<D>): void;
  init(): Promise<void>;
  initialise(): Promise<void>;

  admin: AppAdmin;
  repositories: AppRepositories;
  setup: AppSetup;

  isInitialised: boolean;
  isReplaying: boolean;
}
