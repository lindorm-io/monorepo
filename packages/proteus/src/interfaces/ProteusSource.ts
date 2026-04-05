import { ICircuitBreaker } from "@lindorm/breaker";
import { ILogger } from "@lindorm/logger";
import { Constructor, Dict } from "@lindorm/types";
import { CloneOptions } from "../classes/ProteusSource";
import { IEntity } from "./Entity";
import { IProteusQueryBuilder } from "./ProteusQueryBuilder";
import { IProteusRepository } from "./ProteusRepository";
import {
  EntityScannerInput,
  ProteusSourceEventMap,
  TransactionCallback,
  TransactionOptions,
} from "../types";

export type FilterRegistryEntry = {
  params: Dict<unknown>;
  enabled: boolean;
};

export type FilterRegistry = Map<string, FilterRegistryEntry>;

export interface IProteusSource<C = unknown> {
  readonly namespace: string | null;
  readonly driverType: string;
  readonly migrationsTable: string | undefined;
  readonly log: ILogger;
  readonly breaker: ICircuitBreaker | null;

  on<K extends keyof ProteusSourceEventMap<C>>(
    event: K,
    listener: (payload: ProteusSourceEventMap<C>[K]) => void,
  ): void;
  off<K extends keyof ProteusSourceEventMap<C>>(
    event: K,
    listener: (payload: ProteusSourceEventMap<C>[K]) => void,
  ): void;
  once<K extends keyof ProteusSourceEventMap<C>>(
    event: K,
    listener: (payload: ProteusSourceEventMap<C>[K]) => void,
  ): void;

  clone(options?: CloneOptions<C>): IProteusSource<C>;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<boolean>;
  setup(): Promise<void>;

  addEntities(entities: EntityScannerInput): void;

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
