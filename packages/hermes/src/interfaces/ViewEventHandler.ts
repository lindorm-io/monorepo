import { Constructor, Dict } from "@lindorm/types";
import {
  HandlerConditions,
  HandlerIdentifier,
  ViewEventCtx,
  ViewStoreSource,
} from "../types";
import { NameData } from "../utils/private";

export interface IViewEventHandler<
  C extends Constructor = Constructor,
  S extends Dict = Dict,
> {
  aggregate: HandlerIdentifier;
  conditions: HandlerConditions;
  event: NameData;
  source: ViewStoreSource;
  view: HandlerIdentifier;
  handler(ctx: ViewEventCtx<C, S>): Promise<void>;
}
