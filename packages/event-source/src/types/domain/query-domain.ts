import { DtoClass, State } from "../generic";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { QueryHandlerImplementation } from "../../handler";

export interface QueryDomainOptions {
  mongo: IMongoConnection;
  postgres: IPostgresConnection;
}

export interface IQueryDomain<TQuery extends DtoClass = DtoClass, TState extends State = State> {
  registerQueryHandler(queryHandler: QueryHandlerImplementation<TQuery, unknown, TState>): void;
  query<TResult>(query: TQuery): Promise<TResult>;
}
