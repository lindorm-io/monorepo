import { ICircuitBreaker } from "@lindorm/breaker";
import { ILogger } from "@lindorm/logger";
import { Constructor, Dict } from "@lindorm/types";
import { CloneOptions } from "../classes/ProteusSource";
import { IEntity } from "./Entity";
import { IEntitySubscriber } from "./EntitySubscriber";
import { IProteusQueryBuilder } from "./ProteusQueryBuilder";
import { IProteusRepository } from "./ProteusRepository";
import { EntityScannerInput, TransactionCallback, TransactionOptions } from "../types";

export type FilterRegistryEntry = {
  params: Dict<unknown>;
  enabled: boolean;
};

export type FilterRegistry = Map<string, FilterRegistryEntry>;

export interface IProteusSource {
  readonly namespace: string | null;
  readonly driverType: string;
  readonly migrationsTable: string | undefined;
  readonly log: ILogger;
  readonly breaker: ICircuitBreaker | null;

  clone(options?: CloneOptions): IProteusSource;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<boolean>;
  setup(): Promise<void>;

  addEntities(entities: EntityScannerInput): void;
  addSubscriber(subscriber: IEntitySubscriber): void;

  setFilterParams(name: string, params: Dict<unknown>): void;
  enableFilter(name: string): void;
  disableFilter(name: string): void;
  getFilterRegistry(): FilterRegistry;

  repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E>;
  queryBuilder<E extends IEntity>(target: Constructor<E>): IProteusQueryBuilder<E>;
  client<T>(): Promise<T>;
  transaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T>;
}
