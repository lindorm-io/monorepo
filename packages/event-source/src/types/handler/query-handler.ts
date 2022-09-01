import { Constructor, DtoClass, State } from "../generic";
import { HandlerIdentifier } from "./handler";
import { ILogger } from "@lindorm-io/winston";
import {
  MemoryViewRepository,
  MongoViewRepository,
  PostgresViewRepository,
} from "../../infrastructure";

export interface QueryRepositories<TState extends State = State> {
  memory: MemoryViewRepository<TState>;
  mongo: MongoViewRepository<TState>;
  postgres: PostgresViewRepository<TState>;
}

export interface QueryHandlerContext<
  TQuery extends DtoClass = DtoClass,
  TState extends State = State,
> {
  query: TQuery;
  logger: ILogger;
  repositories: QueryRepositories<TState>;
}

export interface QueryHandler<TQuery extends DtoClass, TResult, TState extends State = State> {
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
