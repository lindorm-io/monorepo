import { IMongoConnection, MongoRepositoryConstructor } from "@lindorm-io/mongo";
import { ServerError } from "@lindorm-io/errors";
import { camelCase } from "@lindorm-io/case";
import { DefaultLindormSocketMiddleware, getSocketError } from "@lindorm-io/koa";

type Options = {
  repositoryKey?: string;
};

export const socketMongoRepositoryMiddleware =
  (
    connection: IMongoConnection,
    Repository: MongoRepositoryConstructor,
    options?: Options,
  ): DefaultLindormSocketMiddleware =>
  (socket, next) => {
    try {
      const repository = options?.repositoryKey || camelCase(Repository.name);

      if (!repository) {
        throw new ServerError("Invalid repository name", {
          debug: { repository },
        });
      }

      socket.ctx.mongo[repository] = new Repository(connection, socket.ctx.logger);

      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
