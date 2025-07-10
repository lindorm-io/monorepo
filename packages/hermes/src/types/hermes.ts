import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { IAggregateModel, ISagaModel, IViewModel } from "../interfaces";
import {
  ChecksumStoreOptions,
  EncryptionStoreOptions,
  EventStoreOptions,
  SagaStoreOptions,
  ViewStoreOptions,
} from "./infrastructure";
import { MessageBusOptions } from "./infrastructure/message-bus";
import { HermesScannerInput } from "./scanner";

export type CloneHermesOptions = {
  logger?: ILogger;
};

export type HermesOptions = {
  checksumStore: ChecksumStoreOptions;
  encryptionStore: EncryptionStoreOptions;
  eventStore: EventStoreOptions;
  messageBus: MessageBusOptions;
  sagaStore: SagaStoreOptions;
  viewStore: ViewStoreOptions;

  modules: HermesScannerInput;
  namespace?: string;

  logger: ILogger;
};

export type HermesCommandOptions<M extends Dict = Dict> = {
  id?: string;
  correlationId?: string;
  delay?: number;
  meta?: M;
};

export type HermesInspectOptions = {
  id: string;
  name: string;
  namespace?: string;
};

export interface HermesAdmin {
  inspect: {
    aggregate<S extends Dict = Dict>(
      aggregate: HermesInspectOptions,
    ): Promise<IAggregateModel<S>>;
    saga<S extends Dict = Dict>(saga: HermesInspectOptions): Promise<ISagaModel<S>>;
    view<S extends Dict = Dict>(view: HermesInspectOptions): Promise<IViewModel<S>>;
  };
}
