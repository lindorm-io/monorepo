import { Constructor, Dict } from "@lindorm/types";
import { HandlerIdentifier, ViewQueryCallback, ViewStoreSource } from "../types";

export interface IViewQueryHandler<
  Q extends Constructor = Constructor,
  S extends Dict = Dict,
  R = any,
> {
  query: string;
  source: ViewStoreSource;
  view: HandlerIdentifier;
  handler: ViewQueryCallback<Q, S, R>;
}
