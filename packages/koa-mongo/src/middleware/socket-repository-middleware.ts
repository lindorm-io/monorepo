import { RepositoryBase } from "@lindorm-io/mongo";
import { DefaultLindormMongoSocketMiddleware } from "../types";
import { camelCase } from "lodash";
import { getSocketError } from "@lindorm-io/koa";

interface Options {
  repositoryKey?: string;
}

export const socketRepositoryMiddleware =
  (Repository: typeof RepositoryBase, options?: Options): DefaultLindormMongoSocketMiddleware =>
  (socket, next) => {
    try {
      const repository = options?.repositoryKey || camelCase(Repository.name);

      /*
       * Ignoring TS here since Repository needs to be abstract
       * to ensure that all input at least attempts to be unique
       */
      // @ts-ignore
      socket.ctx.repository[repository] = new Repository({
        connection: socket.ctx.connection.mongo,
        logger: socket.ctx.logger,
      });

      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
