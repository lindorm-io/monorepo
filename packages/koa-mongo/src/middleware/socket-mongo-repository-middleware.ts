import { DefaultLindormMongoSocketMiddleware } from "../types";
import { MongoRepositoryConstructor } from "@lindorm-io/mongo";
import { ServerError } from "@lindorm-io/errors";
import { camelCase } from "@lindorm-io/case";
import { getSocketError } from "@lindorm-io/koa";

type Options = {
  repositoryKey?: string;
};

export const socketMongoRepositoryMiddleware =
  (
    Repository: MongoRepositoryConstructor,
    options?: Options,
  ): DefaultLindormMongoSocketMiddleware =>
  (socket, next) => {
    try {
      const repository = options?.repositoryKey || camelCase(Repository.name);

      if (!repository) {
        throw new ServerError("Invalid repository name", {
          debug: { repository },
        });
      }

      socket.ctx.mongo[repository] = new Repository(socket.ctx.connection.mongo, socket.ctx.logger);

      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
