import type { ILogger } from "@lindorm/logger";
import type { Constructor, Dict } from "@lindorm/types";
import type { HermesEventName } from "../types/hermes-event-name";
import type { HermesViewEntity } from "../entities/HermesViewEntity";
import type { AggregateState } from "../types/aggregate-state";
import type { ReplayHandle, ReplayOptions } from "../types/replay-types";
import type { SagaState } from "../types/saga-state";
import type { IHermesProvider } from "./IHermesProvider";
import type { IHermesSession } from "./IHermesSession";

export interface IHermes extends IHermesProvider {
  setup(): Promise<void>;
  teardown(): Promise<void>;
  session(options?: { logger?: ILogger }): IHermesSession;

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
