import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import { IHermesMessage } from "../../interfaces";
import { HandlerIdentifier, HandlerIdentifierMultipleContexts } from "../identifiers";
import { SagaDispatchOptions } from "../models";
import { HandlerConditions } from "./handler";

export type SagaEventHandlerContext<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
  D extends ClassLike = ClassLike,
> = {
  event: E;
  logger: ILogger;
  state: S;
  destroy(): void;
  dispatch(command: D, options?: SagaDispatchOptions): void;
  mergeState(data: Partial<S>): void;
  setState(state: S): void;
  timeout(name: string, data: Record<string, any>, delay: number): void;
};

export type SagaEventHandlerFileAggregate = {
  name?: string;
  context?: Array<string> | string;
};

export type SagaEventHandlerOptions<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
  D extends ClassLike = ClassLike,
> = {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions?: HandlerConditions;
  eventName: string;
  saga: HandlerIdentifier;
  version?: number;
  getSagaId?(message: IHermesMessage): string;
  handler(ctx: SagaEventHandlerContext<E, S, D>): Promise<void>;
};
