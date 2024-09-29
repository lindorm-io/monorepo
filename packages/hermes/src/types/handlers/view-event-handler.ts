import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import { ViewStoreType } from "../../enums";
import { IHermesMessage, IViewStore } from "../../interfaces";
import { HandlerIdentifier, HandlerIdentifierMultipleContexts } from "../identifiers";
import { StoreIndexes } from "../infrastructure";
import { HandlerConditions } from "./handler";

export type ViewEventHandlerContext<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> = {
  event: E;
  logger: ILogger;
  state: S;
  destroy(): void;
  mergeState(data: Partial<S>): void;
  setState(state: S): void;
};

export type ViewEventHandlerFileAggregate = {
  name?: string;
  context?: Array<string> | string;
};

export type ViewEventHandlerAdapter<F extends Dict = Dict> = {
  custom?: IViewStore;
  indexes?: StoreIndexes<F>;
  type: ViewStoreType;
};

export type ViewEventHandlerOptions<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> = {
  adapter: ViewEventHandlerAdapter;
  aggregate: HandlerIdentifierMultipleContexts;
  conditions?: HandlerConditions;
  eventName: string;
  version?: number;
  view: HandlerIdentifier;
  getViewId?(event: IHermesMessage<E>): string;
  handler(ctx: ViewEventHandlerContext<E, S>): Promise<void>;
};
