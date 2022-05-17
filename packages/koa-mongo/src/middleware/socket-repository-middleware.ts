import { RepositoryBase } from "@lindorm-io/mongo";
import { DefaultLindormMongoSocketMiddleware } from "../types";
import { camelCase } from "lodash";

interface Options {
  repositoryKey?: string;
}

export const socketRepositoryMiddleware =
  (Repository: typeof RepositoryBase, options?: Options): DefaultLindormMongoSocketMiddleware =>
  (socket, next) => {
    const repository = options?.repositoryKey || camelCase(Repository.name);

    /*
     * Ignoring TS here since Repository needs to be abstract
     * to ensure that all input at least attempts to be unique
     */
    // @ts-ignore
    socket.ctx.repository[repository] = new Repository({
      db: socket.ctx.connection.mongo.database(),
      logger: socket.ctx.logger,
    });

    next();
  };
