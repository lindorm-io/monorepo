import { ILogger } from "@lindorm/logger";
import { ClassLike, DeepPartial, Dict } from "@lindorm/types";
import { NameData } from "../../utils/private";
import { HandlerIdentifier } from "../identifiers";
import { ViewStoreSource } from "../infrastructure";
import { HandlerConditions } from "./conditions";

export type ViewEventCtx<E extends ClassLike, S extends Dict> = {
  event: E;
  logger: ILogger;
  meta: Dict;
  state: S;
  destroy(): void;
  mergeState(data: DeepPartial<S>): void;
  setState(state: S): void;
};

export type ViewEventHandlerOptions<C extends ClassLike, S extends Dict> = {
  aggregate: HandlerIdentifier;
  conditions?: HandlerConditions;
  event: NameData;
  key: string;
  source: ViewStoreSource;
  view: HandlerIdentifier;
  handler(ctx: ViewEventCtx<C, S>): Promise<void>;
};
