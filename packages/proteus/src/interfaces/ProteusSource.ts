import { ICircuitBreaker } from "@lindorm/breaker";
import { CloneOptions } from "../classes/ProteusSource";
import { IProteusRepositoryProvider } from "./ProteusRepositoryProvider";
import { EntityScannerInput, ProteusSourceEventMap } from "../types";
import type { EntityMetadata } from "../internal/entity/types/metadata";

export { FilterRegistry, FilterRegistryEntry } from "./ProteusRepositoryProvider";

export interface IProteusSource<C = unknown> extends IProteusRepositoryProvider<C> {
  readonly migrationsTable: string | undefined;
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
  setup(): Promise<void>;

  addEntities(entities: EntityScannerInput): void;
  getEntityMetadata(): Array<EntityMetadata>;
}
