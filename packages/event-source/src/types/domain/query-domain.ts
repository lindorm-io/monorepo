import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { IRedisConnection } from "@lindorm-io/redis";
import { DtoClass, State } from "../generic";
import { IQueryHandler } from "../handler";

export type QueryDomainOptions = {
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  redis?: IRedisConnection;
};

export interface IQueryDomain<TQuery extends DtoClass = DtoClass, TState extends State = State> {
  registerQueryHandler(queryHandler: IQueryHandler<TQuery, any, TState>): void;
  query<TResult>(query: TQuery): Promise<TResult>;
}
