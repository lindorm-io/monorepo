import { Logger } from "@lindorm-io/core-logger";
import { Constructor, DtoClass, State } from "../generic";
import {
  IMemoryRepository,
  IMongoRepository,
  IPostgresRepository,
  IRedisRepository,
} from "../view-repository";
import { HandlerIdentifier } from "./handler";

export interface QueryRepositories<TState extends State = State> {
  memory: IMemoryRepository<TState>;
  mongo: IMongoRepository<TState>;
  postgres: IPostgresRepository<TState>;
  redis: IRedisRepository<TState>;
}

export interface QueryHandlerContext<
  TQuery extends DtoClass = DtoClass,
  TState extends State = State,
> {
  query: TQuery;
  logger: Logger;
  repositories: QueryRepositories<TState>;
}

export interface QueryHandler<
  TQuery extends DtoClass = DtoClass,
  TResult = unknown,
  TState extends State = State,
> {
  query: Constructor<TQuery>;
  view: string;
  context?: string;
  handler(ctx: QueryHandlerContext<TQuery, TState>): Promise<TResult>;
}

export interface QueryHandlerOptions<
  TQuery extends DtoClass = DtoClass,
  TResult = any,
  TState extends State = State,
> {
  queryName: string;
  view: HandlerIdentifier;
  handler(ctx: QueryHandlerContext<TQuery, TState>): Promise<TResult>;
}

export interface IQueryHandler<
  TQuery extends DtoClass = DtoClass,
  TResult = any,
  TState extends State = State,
> {
  queryName: string;
  view: HandlerIdentifier;
  handler(ctx: QueryHandlerContext<TQuery, TState>): Promise<TResult>;
}
