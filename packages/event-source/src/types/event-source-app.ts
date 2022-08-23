import { Aggregate, Saga } from "../entity";
import { ClassDTO, Data, State } from "./generic";
import { EventEmitterListener } from "./event-emitter";
import { EventStoreAdapterType, IEventStore } from "./event-store";
import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { ISagaStore, SagaStoreAdapterType } from "./saga-store";
import { IViewStore, ViewStoreAdapterType } from "./view-store";
import { MessageBusQueueType } from "./message-bus";
import { MongoViewRepository, PostgresViewRepository } from "../infrastructure";
import { ReplayOptions } from "./domain";
import {
  AggregateCommandHandlerImplementation,
  AggregateEventHandlerImplementation,
  SagaEventHandlerImplementation,
  ViewEventHandlerImplementation,
} from "../handler";
import { AggregateIdentifier } from "./entity";

export interface AdapterOptions {
  eventStore?: EventStoreAdapterType;
  sagaStore?: SagaStoreAdapterType;
  viewStore?: ViewStoreAdapterType;
  messageBus?: MessageBusQueueType;
}

export interface ConnectionOptions {
  amqp?: IAmqpConnection;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
}

export interface ScannerOptions {
  extensions?: Array<string>;
  include?: Array<RegExp>;
  exclude?: Array<RegExp>;
}

export interface PrivateAppOptions {
  adapters?: AdapterOptions;
  context?: string;
  directory?: string;
  scanner?: ScannerOptions;
  dangerouslyRegisterHandlersManually?: boolean;
  dangerouslyRegisterCommands?: Array<ClassDTO>;
  dangerouslyRegisterEvents?: Array<ClassDTO>;
}

export interface AppOptions extends PrivateAppOptions {
  connections?: ConnectionOptions;
  custom?: {
    messageBus?: IMessageBus;
    eventStore?: IEventStore;
    sagaStore?: ISagaStore;
    viewStore?: IViewStore;
    require?: NodeJS.Require;
  };
}

export interface AppPublishOptions {
  aggregate?: Partial<AggregateIdentifier>;
  correlationId?: string;
  delay?: number;
  mandatory?: boolean;
  origin?: string;
  originator?: string | null;
  version?: number;
}

export type AppPublishResult = {
  result: "OK" | "QUEUED";
  aggregate: AggregateIdentifier;
};

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
  mongo<S>(name: string, context?: string): MongoViewRepository<S>;
  postgres<S>(name: string, context?: string): PostgresViewRepository<S>;
}

export interface AppSetup {
  registerAggregateCommandHandlers(
    handlers: Array<AggregateCommandHandlerImplementation>,
  ): Promise<void>;
  registerAggregateEventHandlers(
    handlers: Array<AggregateEventHandlerImplementation>,
  ): Promise<void>;
  registerSagaEventHandlers(handlers: Array<SagaEventHandlerImplementation>): Promise<void>;
  registerViewEventHandlers(handlers: Array<ViewEventHandlerImplementation>): Promise<void>;
  registerCommandAggregate(name: string, aggregate: string): void;
  registerEventAggregate(name: string, aggregate: string): void;
}

export interface IEventSource<TCommand extends ClassDTO = ClassDTO> {
  publish(command: TCommand, options: AppPublishOptions): Promise<AppPublishResult>;
  on<D = Data>(eventName: string, listener: EventEmitterListener<D>): void;
  init(): Promise<void>;
  initialise(): Promise<void>;

  admin: AppAdmin;
  repositories: AppRepositories;
  setup: AppSetup;

  isInitialised: boolean;
  isReplaying: boolean;
}
