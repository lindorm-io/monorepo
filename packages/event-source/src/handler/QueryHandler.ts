import {
  DtoClass,
  HandlerIdentifier,
  IQueryHandler,
  QueryHandlerContext,
  QueryHandlerOptions,
  State,
} from "../types";

export class QueryHandlerImplementation<
  TQuery extends DtoClass = DtoClass,
  TResult = any,
  TState extends State = State,
> implements IQueryHandler<TQuery, TResult, TState>
{
  public readonly queryName: string;
  public readonly view: HandlerIdentifier;
  public readonly handler: (ctx: QueryHandlerContext<TQuery, TState>) => Promise<TResult>;

  public constructor(options: QueryHandlerOptions<TQuery, TResult, TState>) {
    this.queryName = options.queryName;
    this.view = options.view;
    this.handler = options.handler;
  }
}
