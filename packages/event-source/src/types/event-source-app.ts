import { StructureScannerOptions } from "@lindorm-io/structure-scanner";
import { Aggregate, Saga, View } from "../model";
import { ChecksumStoreOptions } from "./checksum-store";
import { ReplayOptions } from "./domain";
import { EventEmitterListener } from "./event-emitter";
import { EventStoreOptions } from "./event-store";
import { Data, DtoClass, Metadata, State } from "./generic";
import {
  HandlerIdentifier,
  IAggregateCommandHandler,
  IAggregateEventHandler,
  IChecksumEventHandler,
  IErrorHandler,
  IQueryHandler,
  ISagaEventHandler,
  IViewEventHandler,
  ViewEventHandlerAdapter,
} from "./handler";
import { MessageBusOptions } from "./message-bus";
import { AggregateIdentifier } from "./model";
import { SagaStoreOptions } from "./saga-store";
import { ViewStoreOptions } from "./view-store";

export type EventSourceDirectories = {
  aggregates: string;
  queries: string;
  sagas: string;
  views: string;
};

export type EventSourceFileFilterOptions = {
  include: Array<RegExp>;
  exclude: Array<RegExp>;
};

export type EventSourceScannerOptions = Pick<
  StructureScannerOptions,
  "deniedDirectories" | "deniedExtensions" | "deniedFilenames" | "deniedTypes"
>;

export type EventSourcePrivateOptions = {
  checksumStore: ChecksumStoreOptions;
  context: string;
  dangerouslyRegisterHandlersManually: boolean;
  directories: EventSourceDirectories;
  eventStore: EventStoreOptions;
  fileFilter: EventSourceFileFilterOptions;
  messageBus: MessageBusOptions;
  require: NodeJS.Require;
  sagaStore: SagaStoreOptions;
  scanner: EventSourceScannerOptions;
  viewStore: ViewStoreOptions;
};

export type EventSourceOptions = Partial<
  Omit<
    EventSourcePrivateOptions,
    "eventStore" | "fileFilter" | "messageBus" | "sagaStore" | "scanner" | "viewStore"
  >
> & {
  eventStore?: EventStoreOptions;
  fileFilter?: Partial<EventSourceFileFilterOptions>;
  messageBus?: MessageBusOptions;
  sagaStore?: SagaStoreOptions;
  scanner?: Partial<EventSourceScannerOptions>;
  viewStore?: ViewStoreOptions;
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
  registerChecksumEventHandler(handler: IChecksumEventHandler): Promise<void>;
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
