import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import { HandlerIdentifier } from "../identifiers";

export type AggregateEventHandlerContext<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> = {
  event: E;
  logger: ILogger;
  state: S;
  destroy(): void;
  destroyNext(): void;
  mergeState(data: Partial<S>): void;
  setState(state: S): void;
};

export type AggregateEventHandlerOptions<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> = {
  aggregate: HandlerIdentifier;
  eventName: string;
  version?: number;
  handler(ctx: AggregateEventHandlerContext<E, S>): Promise<void>;
};
