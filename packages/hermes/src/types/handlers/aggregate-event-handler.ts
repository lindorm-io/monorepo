import { ILogger } from "@lindorm/logger";
import { ClassLike, DeepPartial, Dict } from "@lindorm/types";
import { NameData } from "../../utils/private";
import { HandlerIdentifier } from "../identifiers";

export type AggregateEventCtx<E extends ClassLike, S extends Dict> = {
  event: E;
  logger: ILogger;
  meta: Dict;
  state: S;
  destroy(): void;
  destroyNext(): void;
  mergeState(data: DeepPartial<S>): void;
  setState(state: S): void;
};

export type AggregateEventHandlerOptions<C extends ClassLike, S extends Dict> = {
  aggregate: HandlerIdentifier;
  event: NameData;
  key: string;
  handler(ctx: AggregateEventCtx<C, S>): Promise<void>;
};
