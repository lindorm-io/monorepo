import { ILogger } from "@lindorm/logger";
import { ClassLike, Constructor, Dict } from "@lindorm/types";
import {
  IMongoViewRepository,
  IPostgresViewRepository,
  IRedisViewRepository,
} from "../../interfaces";
import { ViewQueryCallback } from "../decorators";
import { HandlerIdentifier } from "../identifiers";
import { ViewStoreSource } from "../infrastructure";

export type QuerySources<S extends Dict = Dict> = {
  mongo: IMongoViewRepository<S>;
  postgres: IPostgresViewRepository<S>;
  redis: IRedisViewRepository<S>;
};

export type ViewQueryCtx<Q extends ClassLike = ClassLike, S extends Dict = Dict> = {
  query: Q;
  logger: ILogger;
  repositories: QuerySources<S>;
};

export type ViewQueryHandlerOptions<
  Q extends Constructor = Constructor,
  S extends Dict = Dict,
  R = any,
> = {
  key: string;
  query: string;
  source: ViewStoreSource;
  view: HandlerIdentifier;
  handler: ViewQueryCallback<Q, S, R>;
};
