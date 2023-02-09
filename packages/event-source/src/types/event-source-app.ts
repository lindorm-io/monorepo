import { Aggregate, Saga, View } from "../model";
import { AggregateIdentifier } from "./model";
import { DtoClass, Data, State, Metadata } from "./generic";
import { EventEmitterListener } from "./event-emitter";
import { EventStoreAdapterType, IEventStore } from "./event-store";
import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { ISagaStore, SagaStoreAdapterType } from "./saga-store";
import { MessageBusQueueType } from "./message-bus";
import { ReplayOptions } from "./domain";
import {
  HandlerIdentifier,
  IAggregateCommandHandler,
  IAggregateEventHandler,
  IErrorHandler,
  IQueryHandler,
  ISagaEventHandler,
  IViewEventHandler,
  ViewEventHandlerAdapter,
} from "./handler";

export type EventSourceAdapterOptions = {
  eventStore?: EventStoreAdapterType;
  sagaStore?: SagaStoreAdapterType;
  messageBus?: MessageBusQueueType;
};

export type EventSourceConnectionOptions = {
  amqp?: IAmqpConnection;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
};

export type EventSourceCustomOptions = {
  messageBus?: IMessageBus;
  eventStore?: IEventStore;
  sagaStore?: ISagaStore;
  require?: NodeJS.Require;
};

export type EventSourceScannerOptions = {
  extensions: Array<string>;
  include: Array<RegExp>;
  exclude: Array<RegExp>;
};

export type EventSourcePrivateOptions = {
  adapters: EventSourceAdapterOptions;
  context: string;
  aggregates: string;
  queries: string;
  scanner: EventSourceScannerOptions;
  dangerouslyRegisterHandlersManually: boolean;
};

export type EventSourceOptions = Partial<Omit<EventSourcePrivateOptions, "scanner">> & {
  connections?: EventSourceConnectionOptions;
  custom?: EventSourceCustomOptions;
  scanner?: Partial<EventSourceScannerOptions>;
};

export type EventSourceCommandOptions<TMetadata extends Metadata = Metadata> = {
  aggregate?: Partial<AggregateIdentifier>;
  correlationId?: string;
  delay?: number;
  metadata?: TMetadata;
};

export type EventSourceCommandResult = {
  result: "OK" | "QUEUED";
  aggregate: AggregateIdentifier;
};

export type EventSourceInspectOptions = {
  id: string;
  name: string;
  context?: string;
};

export interface EventSourceAdmin {
  inspect: {
    aggregate<TState extends State = State>(
      aggregate: EventSourceInspectOptions,
    ): Promise<Aggregate<TState>>;
    saga<TState extends State = State>(saga: EventSourceInspectOptions): Promise<Saga<TState>>;
    view<TState extends State = State>(view: EventSourceInspectOptions): Promise<View<TState>>;
  };
  replay(options: ReplayOptions): Promise<void>;
}

export interface EventSourceSetup {
  registerAggregateCommandHandler(handler: IAggregateCommandHandler): Promise<void>;
  registerAggregateEventHandler(handler: IAggregateEventHandler): Promise<void>;
  registerErrorHandler(handler: IErrorHandler): Promise<void>;
  registerQueryHandler(handler: IQueryHandler): void;
  registerSagaEventHandler(handler: ISagaEventHandler): Promise<void>;
  registerViewEventHandler(handler: IViewEventHandler): Promise<void>;

  registerCommandAggregate(name: string, aggregate: string): void;
  registerViewAdapter(adapter: HandlerIdentifier & ViewEventHandlerAdapter): void;
}

export interface IEventSource<
  TCommand extends DtoClass = DtoClass,
  TQuery extends DtoClass = DtoClass,
> {
  on<TData = Data>(eventName: string, listener: EventEmitterListener<TData>): void;
  init(): Promise<void>;
  initialise(): Promise<void>;

  command<TMetadata extends Metadata = Metadata>(
    command: TCommand,
    options: EventSourceCommandOptions<TMetadata>,
  ): Promise<EventSourceCommandResult>;
  query<TResult>(query: TQuery): Promise<TResult>;

  admin: EventSourceAdmin;
  setup: EventSourceSetup;

  isInitialised: boolean;
  isInitialising: boolean;
  isReplaying: boolean;
}
