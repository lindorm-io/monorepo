import { IRedisConnection, RedisRepositoryConstructor } from "@lindorm-io/redis";
import { camelCase } from "@lindorm-io/case";
import { DefaultLindormSocketMiddleware, getSocketError } from "@lindorm-io/koa";
import { ServerError } from "@lindorm-io/errors";

interface Options {
  repositoryKey?: string;
}

export const socketRedisRepositoryMiddleware =
  (
    connection: IRedisConnection,
    Repository: RedisRepositoryConstructor,
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

      socket.ctx.redis[repository] = new Repository(connection, socket.ctx.logger);

      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
