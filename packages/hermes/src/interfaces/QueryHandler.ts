import { ClassLike, Constructor, Dict } from "@lindorm/types";
import { HandlerIdentifier, QueryHandlerContext } from "../types";

export interface IQueryHandler<
  Q extends ClassLike = ClassLike,
  R = unknown,
  S extends Dict = Dict,
> {
  query: Constructor<Q>;
  view: string;
  context?: string;
  handler(ctx: QueryHandlerContext<Q, S>): Promise<R>;
}

export interface IHermesQueryHandler<
  Q extends ClassLike = ClassLike,
  R = any,
  S extends Dict = Dict,
> {
  queryName: string;
  view: HandlerIdentifier;
  handler(ctx: QueryHandlerContext<Q, S>): Promise<R>;
}
