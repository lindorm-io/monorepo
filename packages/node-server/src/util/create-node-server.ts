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
  keyPairCleanupWorker,
  keyPairJwksMemoryWorker,
  keyPairJwksRedisWorker,
  KeyPairMemoryCache,
  keyPairMongoMemoryWorker,
  keyPairMongoRedisWorker,
  KeyPairMongoRepository,
  KeyPairRedisRepository,
  keyPairRotationWorker,
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
import { getServiceOptions } from "./get-service-options";

export const createNodeServer = <
  Context extends LindormNodeServerKoaContext = LindormNodeServerKoaContext,
>(
  options: CreateNodeServerOptions,
): KoaApp<Context> => {
  const middleware: Array<DefaultLindormMiddleware> = [axiosMiddleware({ alias: "axiosClient" })];
  const socketMiddleware: Array<DefaultLindormSocketMiddleware> = [
    socketAxiosMiddleware({ alias: "axiosClient" }),
  ];

  const services = getServiceOptions(options.services);

  for (const service of services) {
    middleware.push(
      axiosMiddleware({
        host: service.host,
        port: service.port || undefined,
        alias: service.name,
        client: options.client,
        middleware: [axiosTransformBodyCaseMiddleware(), axiosTransformQueryCaseMiddleware()],
      }),
    );
    socketMiddleware.push(
      socketAxiosMiddleware({
        host: service.host,
        port: service.port || undefined,
        alias: service.name,
        client: options.client,
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

    if (options.keystore?.storage?.includes("memory")) {
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

    if (options.keystore?.storage?.includes("mongo")) {
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

    if (options.keystore?.storage?.includes("redis")) {
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

  if (options.keystore?.storage?.length) {
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

  if (options.issuer && options.mongoConnection && options.keystore?.generated?.length) {
    for (const keyType of options.keystore.generated) {
      koa.addWorker(
        keyPairRotationWorker({
          keyType,
          logger: options.logger,
          mongoConnection: options.mongoConnection,
          origin: options.issuer,
          retry: { maximumAttempts: 30 },
        }),
      );
    }

    koa.addWorker(
      keyPairCleanupWorker({
        logger: options.logger,
        mongoConnection: options.mongoConnection,
        retry: { maximumAttempts: 30 },
      }),
    );

    if (options.memoryDatabase && options.keystore.storage?.includes("memory")) {
      koa.addWorker(
        keyPairMongoMemoryWorker({
          logger: options.logger,
          memoryDatabase: options.memoryDatabase,
          mongoConnection: options.mongoConnection,
          retry: { maximumAttempts: 30 },
        }),
      );
    }

    if (options.redisConnection && options.keystore.storage?.includes("redis")) {
      koa.addWorker(
        keyPairMongoRedisWorker({
          logger: options.logger,
          mongoConnection: options.mongoConnection,
          redisConnection: options.redisConnection,
          retry: { maximumAttempts: 30 },
        }),
      );
    }
  }

  if (options.keystore?.jwks?.length && options.keystore?.storage?.length) {
    const jwks = getServiceOptions(options.keystore.jwks);

    for (const service of jwks) {
      if (options.memoryDatabase && options.keystore.storage.includes("memory")) {
        koa.addWorker(
          keyPairJwksMemoryWorker({
            host: service.host,
            port: service.port || undefined,
            alias: service.name,
            client: options.client,
            logger: options.logger,
            memoryDatabase: options.memoryDatabase,
            retry: { maximumAttempts: 30 },
          }),
        );
      }

      if (options.redisConnection && options.keystore.storage.includes("redis")) {
        koa.addWorker(
          keyPairJwksRedisWorker({
            host: service.host,
            port: service.port || undefined,
            alias: service.name,
            client: options.client,
            logger: options.logger,
            redisConnection: options.redisConnection,
            retry: { maximumAttempts: 30 },
          }),
        );
      }
    }
  }

  if (options.keystore?.exposed?.includes("public")) {
    koa.addRoute(
      "/.well-known/jwks.json",
      createWellKnownJwksRouter<Context>(options.keystore?.exposed?.includes("external")),
    );
  }

  return koa;
};
