import { Middleware } from "@lindorm-io/koa";
import { MongoContext } from "../types";
import { RepositoryBase } from "@lindorm-io/mongo";
import { camelCase } from "lodash";

interface Options {
  repositoryKey?: string;
}

export const repositoryMiddleware =
  (Repository: typeof RepositoryBase, options?: Options): Middleware<MongoContext> =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("mongo");

    const repository = options?.repositoryKey || camelCase(Repository.name);

    /*
     * Ignoring TS here since Repository needs to be abstract
     * to ensure that all input at least attempts to be unique
     */
    // @ts-ignore
    ctx.repository[repository] = new Repository({
      db: ctx.connection.mongo.database(),
      logger: ctx.logger,
    });

    metric.end();

    await next();
  };
