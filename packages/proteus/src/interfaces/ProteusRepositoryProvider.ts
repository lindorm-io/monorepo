import type { ILogger } from "@lindorm/logger";
import type { Constructor, Dict } from "@lindorm/types";
import type { IEntity } from "./Entity.js";
import type { IProteusQueryBuilder } from "./ProteusQueryBuilder.js";
import type { IProteusRepository } from "./ProteusRepository.js";
import type { TransactionCallback, TransactionOptions } from "../types/index.js";

export type FilterRegistryEntry = {
  params: Dict<unknown>;
  enabled: boolean;
};

export type FilterRegistry = Map<string, FilterRegistryEntry>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface IProteusRepositoryProvider<C = unknown> {
  readonly namespace: string | null;
  readonly driverType: string;
  readonly log: ILogger;

  hasEntity<E extends IEntity>(target: Constructor<E>): boolean;

  repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E>;
  queryBuilder<E extends IEntity>(target: Constructor<E>): IProteusQueryBuilder<E>;
  client<T>(): Promise<T>;
  transaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T>;
  ping(): Promise<boolean>;

  setFilterParams(name: string, params: Dict<unknown>): void;
  enableFilter(name: string): void;
  disableFilter(name: string): void;
  getFilterRegistry(): FilterRegistry;
}
