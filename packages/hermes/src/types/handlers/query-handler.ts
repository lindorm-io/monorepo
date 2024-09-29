import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import {
  IMongoViewRepository,
  IPostgresViewRepository,
  IRedisViewRepository,
} from "../../interfaces";
import { HandlerIdentifier } from "../identifiers";

export type QueryRepositories<S extends Dict = Dict> = {
  mongo: IMongoViewRepository<S>;
  postgres: IPostgresViewRepository<S>;
  redis: IRedisViewRepository<S>;
};

export type QueryHandlerContext<
  Q extends ClassLike = ClassLike,
  S extends Dict = Dict,
> = {
  query: Q;
  logger: ILogger;
  repositories: QueryRepositories<S>;
};

export type QueryHandlerOptions<
  Q extends ClassLike = ClassLike,
  R = any,
  S extends Dict = Dict,
> = {
  queryName: string;
  view: HandlerIdentifier;
  handler(ctx: QueryHandlerContext<Q, S>): Promise<R>;
};
