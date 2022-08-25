import { Aggregate, Saga } from "../entity";
import { AggregateIdentifier } from "./entity";
import { DtoClass, Data, State } from "./generic";
import { EventEmitterListener } from "./event-emitter";
import { EventStoreAdapterType, IEventStore } from "./event-store";
import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { ISagaStore, SagaStoreAdapterType } from "./saga-store";
import { IViewStore, ViewStoreAdapterType } from "./view-store";
import { MessageBusQueueType } from "./message-bus";
import { ReplayOptions } from "./domain";
import {
  HandlerIdentifier,
  IAggregateCommandHandler,
  IAggregateEventHandler,
  IQueryHandler,
  ISagaEventHandler,
  IViewEventHandler,
} from "./handler";
import { ViewEntity } from "../infrastructure";

export interface EventSourceAdapterOptions {
  eventStore?: EventStoreAdapterType;
  sagaStore?: SagaStoreAdapterType;
  viewStore?: ViewStoreAdapterType;
  messageBus?: MessageBusQueueType;
}

export interface EventSourceConnectionOptions {
  amqp?: IAmqpConnection;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
}

export interface EventSourceCustomOptions {
  messageBus?: IMessageBus;
  eventStore?: IEventStore;
  sagaStore?: ISagaStore;
  viewStore?: IViewStore;
  require?: NodeJS.Require;
}

export interface EventSourceScannerOptions {
  extensions?: Array<string>;
  include?: Array<RegExp>;
  exclude?: Array<RegExp>;
}

export interface EventSourcePrivateOptions {
  adapters?: EventSourceAdapterOptions;
  context?: string;
  aggregates?: string;
  queries?: string;
  scanner?: EventSourceScannerOptions;
  dangerouslyRegisterHandlersManually?: boolean;
}

export interface EventSourceOptions extends EventSourcePrivateOptions {
  connections?: EventSourceConnectionOptions;
  custom?: EventSourceCustomOptions;
}

export interface EventSourcePublishOptions {
  aggregate?: Partial<AggregateIdentifier>;
  correlationId?: string;
  delay?: number;
  origin?: string;
  originId?: string | null;
}

export type EventSourcePublishResult = {
  result: "OK" | "QUEUED";
  aggregate: AggregateIdentifier;
};

export interface EventSourceInspectOptions {
  id: string;
  name: string;
  context?: string;
}

export interface EventSourceAdmin {
  inspect: {
    aggregate<S = State>(aggregate: EventSourceInspectOptions): Promise<Aggregate<S>>;
    saga<S = State>(saga: EventSourceInspectOptions): Promise<Saga<S>>;
  };
  replay(options: ReplayOptions): Promise<void>;
}

export interface EventSourceSetup {
  registerAggregateCommandHandler(handlers: IAggregateCommandHandler): Promise<void>;
  registerAggregateEventHandler(handlers: IAggregateEventHandler): Promise<void>;
  registerCommandAggregate(name: string, aggregate: string): void;
  registerQueryHandler(handlers: IQueryHandler): Promise<void>;
  registerSagaEventHandler(handlers: ISagaEventHandler): Promise<void>;
  registerViewEntity(view: HandlerIdentifier, viewEntity: typeof ViewEntity): void;
  registerViewEventHandler(handlers: IViewEventHandler): Promise<void>;
}

export interface IEventSource<
  TCommand extends DtoClass = DtoClass,
  TQuery extends DtoClass = DtoClass,
> {
  on<D = Data>(eventName: string, listener: EventEmitterListener<D>): void;
  init(): Promise<void>;
  initialise(): Promise<void>;

  publish(command: TCommand, options: EventSourcePublishOptions): Promise<EventSourcePublishResult>;
  query<TResult>(query: TQuery): Promise<TResult>;

  admin: EventSourceAdmin;
  setup: EventSourceSetup;

  isInitialised: boolean;
  isInitialising: boolean;
  isReplaying: boolean;
}
