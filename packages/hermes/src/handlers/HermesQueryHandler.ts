import { snakeCase } from "@lindorm/case";
import { ClassLike, Dict } from "@lindorm/types";
import { IHermesQueryHandler } from "../interfaces";
import { HandlerIdentifier, QueryHandlerContext, QueryHandlerOptions } from "../types";

export class HermesQueryHandler<
  Q extends ClassLike = ClassLike,
  R = any,
  S extends Dict = Dict,
> implements IHermesQueryHandler<Q, R, S>
{
  public readonly queryName: string;
  public readonly view: HandlerIdentifier;
  public readonly handler: (ctx: QueryHandlerContext<Q, S>) => Promise<R>;

  public constructor(options: QueryHandlerOptions<Q, R, S>) {
    this.queryName = snakeCase(options.queryName);
    this.view = {
      name: snakeCase(options.view.name),
      context: snakeCase(options.view.context),
    };
    this.handler = options.handler;
  }
}
