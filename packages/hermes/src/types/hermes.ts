import { ILogger } from "@lindorm/logger";
import { StructureScannerOptions } from "@lindorm/scanner";
import { Dict } from "@lindorm/types";
import {
  IAggregate,
  IHermesAggregateCommandHandler,
  IHermesAggregateEventHandler,
  IHermesChecksumEventHandler,
  IHermesErrorHandler,
  IHermesQueryHandler,
  IHermesSagaEventHandler,
  IHermesViewEventHandler,
  ISaga,
  IView,
} from "../interfaces";
import { ViewEventHandlerAdapter } from "./handlers";
import { AggregateIdentifier, HandlerIdentifier } from "./identifiers";
import {
  ChecksumStoreOptions,
  EncryptionStoreOptions,
  EventStoreOptions,
  SagaStoreOptions,
  ViewStoreOptions,
} from "./infrastructure";
import { MessageBusOptions } from "./infrastructure/message-bus";

export type CloneHermesOptions = {
  logger?: ILogger;
};

export type HermesDirectories = {
  aggregates: string;
  queries: string;
  sagas: string;
  views: string;
};

export type HermesFileFilterOptions = {
  include: Array<RegExp>;
  exclude: Array<RegExp>;
};

export type HermesConfig = {
  checksumStore: ChecksumStoreOptions;
  encryptionStore: EncryptionStoreOptions;
  eventStore: EventStoreOptions;
  messageBus: MessageBusOptions;
  sagaStore: SagaStoreOptions;
  viewStore: ViewStoreOptions;

  context: string;
  dangerouslyRegisterHandlersManually: boolean;
  directories: HermesDirectories;
  fileFilter: HermesFileFilterOptions;
  scanner: StructureScannerOptions;
};

export type HermesOptions = {
  checksumStore: ChecksumStoreOptions;
  encryptionStore: EncryptionStoreOptions;
  eventStore: EventStoreOptions;
  messageBus: MessageBusOptions;
  sagaStore: SagaStoreOptions;
  viewStore: ViewStoreOptions;

  context?: string;
  dangerouslyRegisterHandlersManually?: boolean;
  directories?: Partial<HermesDirectories>;
  fileFilter?: Partial<HermesFileFilterOptions>;
  scanner?: StructureScannerOptions;

  logger: ILogger;
};

export type HermesCommandOptions<M extends Dict = Dict> = {
  aggregate?: Partial<AggregateIdentifier>;
  correlationId?: string;
  delay?: number;
  meta?: M;
};

export type HermesInspectOptions = {
  id: string;
  name: string;
  context?: string;
};

export interface HermesAdmin {
  inspect: {
    aggregate<S extends Dict = Dict>(
      aggregate: HermesInspectOptions,
    ): Promise<IAggregate<S>>;
    saga<S extends Dict = Dict>(saga: HermesInspectOptions): Promise<ISaga<S>>;
    view<S extends Dict = Dict>(view: HermesInspectOptions): Promise<IView<S>>;
  };
  register: {
    aggregateCommandHandler(handler: IHermesAggregateCommandHandler): Promise<void>;
    aggregateEventHandler(handler: IHermesAggregateEventHandler): Promise<void>;
    checksumEventHandler(handler: IHermesChecksumEventHandler): Promise<void>;
    errorHandler(handler: IHermesErrorHandler): Promise<void>;
    queryHandler(handler: IHermesQueryHandler): void;
    sagaEventHandler(handler: IHermesSagaEventHandler): Promise<void>;
    viewEventHandler(handler: IHermesViewEventHandler): Promise<void>;
    commandAggregate(name: string, aggregate: string): void;
    viewAdapter(adapter: HandlerIdentifier & ViewEventHandlerAdapter): void;
  };
}
