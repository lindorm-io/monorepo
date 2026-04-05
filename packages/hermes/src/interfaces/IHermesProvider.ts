import type { ClassLike, Dict } from "@lindorm/types";
import type { AggregateIdentifier } from "../types/aggregate-identifier";
import type { HermesStatus } from "../types/hermes-status";

export interface IHermesProvider {
  readonly status: HermesStatus;

  command(
    command: ClassLike,
    options?: { id?: string; correlationId?: string; delay?: number; meta?: Dict },
  ): Promise<AggregateIdentifier>;

  query<R>(query: ClassLike): Promise<R>;
}
