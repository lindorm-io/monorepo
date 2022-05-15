import { MongoConnection } from "@lindorm-io/mongo";
import { DefaultLindormMongoSocketMiddleware } from "../types";
import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";

export const socketMongoMiddleware = (
  connection: MongoConnection,
): DefaultLindormMongoSocketMiddleware =>
  promisifyLindormSocketMiddleware(async (socket) => {
    await connection.waitForConnection();
    socket.ctx.connection.mongo = connection;

    socket.ctx.logger.debug("mongo connection added to context");
  });
