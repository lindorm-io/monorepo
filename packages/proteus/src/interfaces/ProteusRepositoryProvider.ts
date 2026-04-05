import { ILogger } from "@lindorm/logger";
import { Constructor, Dict } from "@lindorm/types";
import { IEntity } from "./Entity";
import { IProteusQueryBuilder } from "./ProteusQueryBuilder";
import { IProteusRepository } from "./ProteusRepository";
import { TransactionCallback, TransactionOptions } from "../types";

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
