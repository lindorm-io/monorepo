import type { ILogger } from "@lindorm/logger";
import type { ClassLike, Constructor, Dict } from "@lindorm/types";
import type { HermesEventName } from "../types/hermes-event-name";
import type { HermesViewEntity } from "../entities/HermesViewEntity";
import type { AggregateIdentifier } from "../types/aggregate-identifier";
import type { AggregateState } from "../types/aggregate-state";
import type { HermesStatus } from "../types/hermes-status";
import type { ReplayHandle, ReplayOptions } from "../types/replay-types";
import type { SagaState } from "../types/saga-state";

export interface IHermes {
  readonly status: HermesStatus;

  setup(): Promise<void>;
  teardown(): Promise<void>;
  clone(options?: { logger?: ILogger }): IHermes;

  command(
    command: ClassLike,
    options?: { id?: string; correlationId?: string; delay?: number; meta?: Dict },
  ): Promise<AggregateIdentifier>;

  query<R>(query: ClassLike): Promise<R>;

  on(event: HermesEventName, callback: (data: unknown) => void): void;
  off(event: HermesEventName, callback: (data: unknown) => void): void;

  admin: {
    inspect: {
      aggregate<S extends Dict = Dict>(opts: {
        id: string;
        name: string;
        namespace?: string;
      }): Promise<AggregateState<S>>;

      saga<S extends Dict = Dict>(opts: {
        id: string;
        name: string;
        namespace?: string;
      }): Promise<SagaState<S> | null>;

      view<V extends HermesViewEntity>(opts: {
        id: string;
        entity: Constructor<V>;
      }): Promise<V | null>;
    };

    purgeCausations(): Promise<number>;

    replay: {
      view<V extends HermesViewEntity>(
        entity: Constructor<V>,
        options?: ReplayOptions,
      ): ReplayHandle;

      aggregate(aggregate: Constructor, options?: ReplayOptions): ReplayHandle;
    };
  };
}
