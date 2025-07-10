import { ILogger } from "@lindorm/logger";
import { ClassLike, DeepPartial, Dict } from "@lindorm/types";
import { NameData } from "../../utils/private";
import { AggregateIdentifier, HandlerIdentifier } from "../identifiers";
import { SagaDispatchOptions } from "../models";
import { HandlerConditions } from "./conditions";

export type SagaEventCtx<E extends ClassLike, S extends Dict> = {
  aggregate: AggregateIdentifier;
  event: E;
  logger: ILogger;
  meta: Dict;
  state: S;
  destroy(): void;
  dispatch(item: ClassLike, options?: SagaDispatchOptions): void;
  mergeState(data: DeepPartial<S>): void;
  setState(state: S): void;
};

export type SagaEventHandlerOptions<E extends ClassLike, S extends Dict> = {
  aggregate: HandlerIdentifier;
  conditions?: HandlerConditions;
  event: NameData;
  key: string;
  saga: HandlerIdentifier;
  handler(ctx: SagaEventCtx<E, S>): Promise<void>;
};
