import { CreateNodeServerOptions, LindormNodeServerKoaContext } from "../types";
import { DefaultLindormMiddleware, DefaultLindormSocketMiddleware, KoaApp } from "@lindorm-io/koa";
import { axiosMiddleware, socketAxiosMiddleware } from "@lindorm-io/koa-axios";
import { createAdapter } from "@socket.io/redis-adapter";
import { createWellKnownJwksRouter } from "../router";
import { jwtMiddleware, socketJwtMiddleware } from "@lindorm-io/koa-jwt";
import { memoryCacheMiddleware, socketMemoryCacheMiddleware } from "@lindorm-io/koa-memory";
import {
  redisConnectionMiddleware,
  redisRepositoryMiddleware,
  socketRedisConnectionMiddleware,
  socketRedisRepositoryMiddleware,
} from "@lindorm-io/koa-redis";
import {
  amqpMiddleware,
  messageBusMiddleware,
  socketAmqpMiddleware,
  socketMessageBusMiddleware,
} from "@lindorm-io/koa-amqp";
import {
  KeyPairMemoryCache,
  KeyPairMongoRepository,
  KeyPairRedisRepository,
  keystoreMiddleware,
  memoryKeysMiddleware,
  redisKeysMiddleware,
  socketKeystoreMiddleware,
  socketMemoryKeysMiddleware,
  socketRedisKeysMiddleware,
} from "@lindorm-io/koa-keystore";
import {
  mongoConnectionMiddleware,
  mongoRepositoryMiddleware,
  socketMongoConnectionMiddleware,
  socketMongoRepositoryMiddleware,
} from "@lindorm-io/koa-mongo";
import {
  axiosTransformBodyCaseMiddleware,
  axiosTransformQueryCaseMiddleware,
} from "@lindorm-io/axios";

export const createNodeServer = <
  Context extends LindormNodeServerKoaContext = LindormNodeServerKoaContext,
>(
  options: CreateNodeServerOptions,
): KoaApp<Context> => {
  const middleware: Array<DefaultLindormMiddleware> = [
    axiosMiddleware({ clientName: "axiosClient" }),
  ];
  const socketMiddleware: Array<DefaultLindormSocketMiddleware> = [
    socketAxiosMiddleware({ clientName: "axiosClient" }),
  ];

  for (const service of options.services || []) {
    middleware.push(
      axiosMiddleware({
        clientName: service.name,
        host: service.host,
        port: service.port || undefined,
        middleware: [axiosTransformBodyCaseMiddleware(), axiosTransformQueryCaseMiddleware()],
      }),
    );
    socketMiddleware.push(
      socketAxiosMiddleware({
        clientName: service.name,
        host: service.host,
        port: service.port || undefined,
        middleware: [axiosTransformBodyCaseMiddleware(), axiosTransformQueryCaseMiddleware()],
      }),
    );
  }

  if (options.amqpConnection) {
    middleware.push(amqpMiddleware(options.amqpConnection));
    socketMiddleware.push(socketAmqpMiddleware(options.amqpConnection));

    if (options.messageBus) {
      middleware.push(messageBusMiddleware(options.messageBus));
      socketMiddleware.push(socketMessageBusMiddleware(options.messageBus));
    }
  }

  if (options.memoryDatabase) {
    for (const Cache of options.memory || []) {
      middleware.push(memoryCacheMiddleware(options.memoryDatabase, Cache));
      socketMiddleware.push(socketMemoryCacheMiddleware(options.memoryDatabase, Cache));
    }

    if (options.keystore?.keyPairMemory) {
      middleware.push(memoryCacheMiddleware(options.memoryDatabase, KeyPairMemoryCache));
      socketMiddleware.push(
        socketMemoryCacheMiddleware(options.memoryDatabase, KeyPairMemoryCache),
      );

      middleware.push(memoryKeysMiddleware);
      socketMiddleware.push(socketMemoryKeysMiddleware);
    }
  }

  if (options.mongoConnection) {
    middleware.push(mongoConnectionMiddleware(options.mongoConnection));
    socketMiddleware.push(socketMongoConnectionMiddleware(options.mongoConnection));

    for (const MongoRepository of options.mongo || []) {
      middleware.push(mongoRepositoryMiddleware(MongoRepository));
      socketMiddleware.push(socketMongoRepositoryMiddleware(MongoRepository));
    }

    if (options.keystore?.keyPairMongo) {
      middleware.push(mongoRepositoryMiddleware(KeyPairMongoRepository));
      socketMiddleware.push(socketMongoRepositoryMiddleware(KeyPairMongoRepository));
    }
  }

  if (options.redisConnection) {
    middleware.push(redisConnectionMiddleware(options.redisConnection));
    socketMiddleware.push(socketRedisConnectionMiddleware(options.redisConnection));

    for (const RedisRepository of options.redis || []) {
      middleware.push(redisRepositoryMiddleware(RedisRepository));
      socketMiddleware.push(socketRedisRepositoryMiddleware(RedisRepository));
    }

    if (options.keystore?.keyPairRedis) {
      middleware.push(redisRepositoryMiddleware(KeyPairRedisRepository));
      socketMiddleware.push(socketRedisRepositoryMiddleware(KeyPairRedisRepository));

      middleware.push(redisKeysMiddleware);
      socketMiddleware.push(socketRedisKeysMiddleware);
    }

    if (options.useSocketRedisAdapter) {
      options.socketOptions = {
        adapter: createAdapter(
          options.redisConnection.client.duplicate(),
          options.redisConnection.client.duplicate(),
        ),
      };
    }
  }

  if (options.keystore?.keyPairMemory || options.keystore?.keyPairRedis) {
    middleware.push(keystoreMiddleware);
    socketMiddleware.push(socketKeystoreMiddleware);

    middleware.push(jwtMiddleware({ issuer: options.issuer || options.host }));
    socketMiddleware.push(socketJwtMiddleware({ issuer: options.issuer || options.host }));
  }

  for (const item of options.middleware || []) {
    middleware.push(item);
  }

  for (const item of options.socketMiddleware || []) {
    socketMiddleware.push(item);
  }

  const koa = new KoaApp<Context>({ ...options, middleware, socketMiddleware });

  if (options.keystore?.exposePublic) {
    koa.addRoute(
      "/.well-known/jwks.json",
      createWellKnownJwksRouter<Context>(options.keystore?.exposeExternal),
    );
  }

  return koa;
};
