import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { QueryHandlerImplementation } from "../../handler";
import { HandlerIdentifier } from "../handler";
import { ViewEntity } from "../../infrastructure";
import { DtoClass, State } from "../generic";

export interface QueryDomainOptions {
  mongo: IMongoConnection;
  postgres: IPostgresConnection;
}

export interface IQueryDomain<TQuery extends DtoClass = DtoClass, TState extends State = State> {
  registerQueryHandler(queryHandler: QueryHandlerImplementation<TQuery, unknown, TState>): void;
  registerViewEntity(view: HandlerIdentifier, viewEntity: typeof ViewEntity): void;
  query<TResult>(query: TQuery): Promise<TResult>;
  getViewEntity(view: HandlerIdentifier): typeof ViewEntity | undefined;
}
