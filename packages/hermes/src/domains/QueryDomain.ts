import { snakeCase } from "@lindorm/case";
import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IRedisSource } from "@lindorm/redis";
import { ClassLike, Dict } from "@lindorm/types";
import { HandlerNotRegisteredError } from "../errors";
import { HermesQueryHandler } from "../handlers";
import {
  MongoViewRepository,
  NoopMongoViewRepository,
  NoopPostgresViewRepository,
  NoopRedisViewRepository,
  PostgresViewRepository,
  RedisViewRepository,
} from "../infrastructure";
import { IHermesQueryHandler, IQueryDomain } from "../interfaces";
import { QueryDomainOptions, QueryHandlerContext } from "../types";

export class QueryDomain<Q extends ClassLike = ClassLike, S extends Dict = Dict>
  implements IQueryDomain<Q, S>
{
  private readonly logger: ILogger;
  private readonly mongo: IMongoSource | undefined;
  private readonly postgres: IPostgresSource | undefined;
  private readonly queryHandlers: Array<IHermesQueryHandler>;
  private readonly redis: IRedisSource | undefined;

  public constructor(options: QueryDomainOptions) {
    this.logger = options.logger.child(["QueryDomain"]);

    this.mongo = options.mongo;
    this.postgres = options.postgres;
    this.redis = options.redis;

    this.queryHandlers = [];
  }

  public registerQueryHandler<T extends ClassLike = ClassLike>(
    queryHandler: HermesQueryHandler<T>,
  ): void {
    this.logger.debug("Registering query handler", {
      queryName: queryHandler.queryName,
      view: queryHandler.view,
    });

    if (!(queryHandler instanceof HermesQueryHandler)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "HermesQueryHandler",
          actual: typeof queryHandler,
        },
      });
    }

    const existingHandler = this.queryHandlers.some(
      (x) => x.queryName === queryHandler.queryName,
    );

    if (existingHandler) {
      throw new LindormError("Query handler already registered", {
        debug: {
          queryName: queryHandler.queryName,
        },
      });
    }

    this.queryHandlers.push(queryHandler);

    this.logger.verbose("Registered query handler", {
      queryName: queryHandler.queryName,
      view: queryHandler.view,
    });
  }

  public async query<TResult>(query: Q): Promise<TResult> {
    this.logger.debug("Handling query", { query });

    try {
      const queryHandler = this.queryHandlers.find(
        (x) => x.queryName === snakeCase(query.constructor.name),
      );

      if (!(queryHandler instanceof HermesQueryHandler)) {
        throw new HandlerNotRegisteredError();
      }

      const ctx: QueryHandlerContext = {
        query: structuredClone(query),
        logger: this.logger.child(["QueryHandler"]),
        repositories: {
          mongo: this.mongo
            ? new MongoViewRepository<S>(this.mongo, queryHandler.view, this.logger)
            : new NoopMongoViewRepository(),
          postgres: this.postgres
            ? new PostgresViewRepository<S>(this.postgres, queryHandler.view, this.logger)
            : new NoopPostgresViewRepository(),
          redis: this.redis
            ? new RedisViewRepository<S>(this.redis, queryHandler.view, this.logger)
            : new NoopRedisViewRepository(),
        },
      };

      return await queryHandler.handler(ctx);
    } catch (err: any) {
      this.logger.error("Failed to handle query", err);
      throw err;
    }
  }
}
