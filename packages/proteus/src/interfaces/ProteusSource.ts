import type { ICircuitBreaker } from "@lindorm/breaker";
import type { SessionOptions } from "../classes/ProteusSource.js";
import type { IProteusRepositoryProvider } from "./ProteusRepositoryProvider.js";
import type { IProteusSession } from "./ProteusSession.js";
import type { EntityScannerInput, ProteusSourceEventMap } from "../types/index.js";
import type { EntityMetadata } from "../internal/entity/types/metadata.js";

export type { FilterRegistry, FilterRegistryEntry } from "./ProteusRepositoryProvider.js";

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

  session(options?: SessionOptions<C>): IProteusSession<C>;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  addEntities(entities: EntityScannerInput): void;
  getEntityMetadata(): Array<EntityMetadata>;
}
