import {
  axiosTransformBodyCaseMiddleware,
  axiosTransformQueryCaseMiddleware,
} from "@lindorm-io/axios";
import { DefaultLindormMiddleware, DefaultLindormSocketMiddleware, KoaApp } from "@lindorm-io/koa";
import { messageBusMiddleware, socketMessageBusMiddleware } from "@lindorm-io/koa-amqp";
import { axiosMiddleware, socketAxiosMiddleware } from "@lindorm-io/koa-axios";
import { jwtMiddleware, socketJwtMiddleware } from "@lindorm-io/koa-jwt";
import {
  KeyPairMemoryCache,
  KeyPairMongoRepository,
  KeyPairRedisRepository,
  keyPairCleanupWorker,
  keyPairJwksMemoryWorker,
  keyPairJwksRedisWorker,
  keyPairMongoMemoryWorker,
  keyPairMongoRedisWorker,
  keyPairRotationWorker,
  keystoreMiddleware,
  memoryKeysMiddleware,
  redisKeysMiddleware,
  socketKeystoreMiddleware,
  socketMemoryKeysMiddleware,
  socketRedisKeysMiddleware,
} from "@lindorm-io/koa-keystore";
import { memoryCacheMiddleware, socketMemoryCacheMiddleware } from "@lindorm-io/koa-memory";
import {
  mongoConnectionMiddleware,
  mongoRepositoryMiddleware,
  socketMongoConnectionMiddleware,
  socketMongoRepositoryMiddleware,
} from "@lindorm-io/koa-mongo";
import {
  redisConnectionMiddleware,
  redisRepositoryMiddleware,
  socketRedisConnectionMiddleware,
  socketRedisRepositoryMiddleware,
} from "@lindorm-io/koa-redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { createWellKnownJwksRouter } from "../router";
import { CreateNodeServerOptions, LindormNodeServerKoaContext } from "../types";
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

  const logger = options.logger.createChildLogger("CreateNodeServer");

  const {
    amqpConnection,
    client,
    issuer,
    keystore,
    memory,
    memoryDatabase,
    messageBus,
    mongo,
    mongoConnection,
    redis,
    redisConnection,
    useSocketRedisAdapter,
  } = options;

  for (const service of services) {
    logger.debug("Adding axios middleware for service to server", { service });

    middleware.push(
      axiosMiddleware({
        host: service.host,
        port: service.port || undefined,
        alias: service.name,
        client,
        middleware: [axiosTransformBodyCaseMiddleware(), axiosTransformQueryCaseMiddleware()],
      }),
    );

    socketMiddleware.push(
      socketAxiosMiddleware({
        host: service.host,
        port: service.port || undefined,
        alias: service.name,
        client,
        middleware: [axiosTransformBodyCaseMiddleware(), axiosTransformQueryCaseMiddleware()],
      }),
    );
  }

  if (amqpConnection && messageBus) {
    for (const MessageBus of messageBus || []) {
      logger.debug("Adding Message Bus middleware to server", { options: MessageBus.name });

      middleware.push(messageBusMiddleware(amqpConnection, MessageBus));
      socketMiddleware.push(socketMessageBusMiddleware(amqpConnection, MessageBus));
    }
  }

  if (memoryDatabase) {
    for (const Cache of memory || []) {
      logger.debug("Adding memory cache middleware to server", { cache: Cache.name });

      middleware.push(memoryCacheMiddleware(memoryDatabase, Cache));
      socketMiddleware.push(socketMemoryCacheMiddleware(memoryDatabase, Cache));
    }

    if (keystore?.storage?.includes("memory")) {
      logger.debug("Adding memory cache middleware to server", {
        cache: KeyPairMemoryCache.name,
      });

      middleware.push(memoryCacheMiddleware(memoryDatabase, KeyPairMemoryCache));
      socketMiddleware.push(socketMemoryCacheMiddleware(memoryDatabase, KeyPairMemoryCache));

      logger.debug("Adding memory keys middleware to server");

      middleware.push(memoryKeysMiddleware);
      socketMiddleware.push(socketMemoryKeysMiddleware);
    }
  }

  if (mongoConnection) {
    middleware.push(mongoConnectionMiddleware(mongoConnection));
    socketMiddleware.push(socketMongoConnectionMiddleware(mongoConnection));

    for (const MongoRepository of mongo || []) {
      logger.debug("Adding mongo repository middleware to server", {
        repository: MongoRepository.name,
      });

      middleware.push(mongoRepositoryMiddleware(mongoConnection, MongoRepository));
      socketMiddleware.push(socketMongoRepositoryMiddleware(mongoConnection, MongoRepository));
    }

    if (keystore?.storage?.includes("mongo")) {
      logger.debug("Adding mongo keystore middleware to server");

      middleware.push(mongoRepositoryMiddleware(mongoConnection, KeyPairMongoRepository));
      socketMiddleware.push(
        socketMongoRepositoryMiddleware(mongoConnection, KeyPairMongoRepository),
      );
    }
  }

  if (redisConnection) {
    middleware.push(redisConnectionMiddleware(redisConnection));
    socketMiddleware.push(socketRedisConnectionMiddleware(redisConnection));

    for (const RedisRepository of redis || []) {
      logger.debug("Adding redis repository middleware to server", {
        repository: RedisRepository.name,
      });

      middleware.push(redisRepositoryMiddleware(redisConnection, RedisRepository));
      socketMiddleware.push(socketRedisRepositoryMiddleware(redisConnection, RedisRepository));
    }

    if (keystore?.storage?.includes("redis")) {
      logger.debug("Adding mongo keystore middleware to server");

      middleware.push(redisRepositoryMiddleware(redisConnection, KeyPairRedisRepository));
      socketMiddleware.push(
        socketRedisRepositoryMiddleware(redisConnection, KeyPairRedisRepository),
      );

      middleware.push(redisKeysMiddleware);
      socketMiddleware.push(socketRedisKeysMiddleware);
    }

    if (useSocketRedisAdapter) {
      options.socketOptions = {
        adapter: createAdapter(
          redisConnection.client.duplicate(),
          redisConnection.client.duplicate(),
        ),
      };
    }
  }

  if (keystore?.storage?.length) {
    logger.debug("Adding keystore middleware to server");

    middleware.push(keystoreMiddleware);
    socketMiddleware.push(socketKeystoreMiddleware);

    logger.debug("Adding JWT middleware to server");

    middleware.push(jwtMiddleware({ issuer: issuer || options.host }));
    socketMiddleware.push(socketJwtMiddleware({ issuer: issuer || options.host }));
  }

  for (const item of options.middleware || []) {
    middleware.push(item);
  }

  for (const item of options.socketMiddleware || []) {
    socketMiddleware.push(item);
  }

  const koa = new KoaApp<Context>({ ...options, middleware, socketMiddleware });

  if (issuer && mongoConnection && keystore?.generated?.length) {
    for (const keyType of keystore.generated) {
      logger.debug("Adding mongo KeyPair rotation worker", { keyType });

      koa.addWorker(
        keyPairRotationWorker({
          keyType,
          logger: options.logger,
          mongoConnection,
          originUri: issuer,
          retry: { maximumAttempts: 30 },
        }),
      );
    }

    logger.debug("Adding KeyPair cleanup worker");

    koa.addWorker(
      keyPairCleanupWorker({
        logger: options.logger,
        mongoConnection,
        retry: { maximumAttempts: 30 },
      }),
    );

    if (memoryDatabase && keystore.storage?.includes("memory")) {
      logger.debug("Adding memory KeyPair cache worker");

      koa.addWorker(
        keyPairMongoMemoryWorker({
          logger: options.logger,
          memoryDatabase,
          mongoConnection,
          retry: { maximumAttempts: 30 },
        }),
      );
    }

    if (redisConnection && keystore.storage?.includes("redis")) {
      logger.debug("Adding redis KeyPair cache worker");

      koa.addWorker(
        keyPairMongoRedisWorker({
          logger: options.logger,
          mongoConnection,
          redisConnection,
          retry: { maximumAttempts: 30 },
        }),
      );
    }
  }

  if (keystore?.jwks?.length && keystore?.storage?.length) {
    const jwks = getServiceOptions(keystore.jwks);

    for (const service of jwks) {
      if (memoryDatabase && keystore.storage.includes("memory")) {
        koa.addWorker(
          keyPairJwksMemoryWorker({
            host: service.host,
            port: service.port || undefined,
            alias: service.name,
            client,
            logger: options.logger,
            memoryDatabase,
            retry: { maximumAttempts: 30 },
          }),
        );
      }

      if (redisConnection && keystore.storage.includes("redis")) {
        koa.addWorker(
          keyPairJwksRedisWorker({
            host: service.host,
            port: service.port || undefined,
            alias: service.name,
            client,
            logger: options.logger,
            redisConnection,
            retry: { maximumAttempts: 30 },
          }),
        );
      }
    }
  }

  if (keystore?.exposed?.includes("public")) {
    koa.addRoute(
      "/.well-known/jwks.json",
      createWellKnownJwksRouter<Context>(keystore?.exposed?.includes("external")),
    );
  }

  return koa;
};
