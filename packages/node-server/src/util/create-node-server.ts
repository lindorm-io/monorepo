import { CreateNodeServerOptions, LindormNodeServerKoaContext } from "../types";
import { DefaultLindormMiddleware, DefaultLindormSocketMiddleware, KoaApp } from "@lindorm-io/koa";
import { axiosMiddleware, socketAxiosMiddleware } from "@lindorm-io/koa-axios";
import { createAdapter } from "@socket.io/redis-adapter";
import { createWellKnownJwksRouter } from "../router";
import { socketJwtMiddleware, jwtMiddleware } from "@lindorm-io/koa-jwt";
import {
  cacheMiddleware,
  redisMiddleware,
  socketCacheMiddleware,
  socketRedisMiddleware,
} from "@lindorm-io/koa-redis";
import {
  mongoMiddleware,
  repositoryMiddleware,
  socketMongoMiddleware,
  socketRepositoryMiddleware,
} from "@lindorm-io/koa-mongo";
import {
  KeyPairCache,
  KeyPairRepository,
  cacheKeysMiddleware,
  keystoreMiddleware,
  socketCacheKeysMiddleware,
  socketKeystoreMiddleware,
} from "@lindorm-io/koa-keystore";

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
      axiosMiddleware({ clientName: service.name, host: service.host, port: service.port }),
    );
    socketMiddleware.push(
      socketAxiosMiddleware({ clientName: service.name, host: service.host, port: service.port }),
    );
  }

  if (options.mongoConnection) {
    middleware.push(mongoMiddleware(options.mongoConnection));
    socketMiddleware.push(socketMongoMiddleware(options.mongoConnection));

    for (const Repository of options.repositories || []) {
      middleware.push(repositoryMiddleware(Repository));
      socketMiddleware.push(socketRepositoryMiddleware(Repository));
    }

    if (options.keystore?.keyPairRepository) {
      middleware.push(repositoryMiddleware(KeyPairRepository));
      socketMiddleware.push(socketRepositoryMiddleware(KeyPairRepository));
    }
  }

  if (options.redisConnection) {
    middleware.push(redisMiddleware(options.redisConnection));
    socketMiddleware.push(socketRedisMiddleware(options.redisConnection));

    for (const Cache of options.caches || []) {
      middleware.push(cacheMiddleware(Cache));
      socketMiddleware.push(socketCacheMiddleware(Cache));
    }

    if (options.keystore?.keyPairCache !== false) {
      middleware.push(cacheMiddleware(KeyPairCache));
      socketMiddleware.push(socketCacheMiddleware(KeyPairCache));

      middleware.push(cacheKeysMiddleware);
      socketMiddleware.push(socketCacheKeysMiddleware);

      middleware.push(keystoreMiddleware);
      socketMiddleware.push(socketKeystoreMiddleware);

      middleware.push(jwtMiddleware({ issuer: options.issuer || options.host }));
      socketMiddleware.push(socketJwtMiddleware({ issuer: options.issuer || options.host }));
    }

    if (options.useSocketRedisAdapter !== false) {
      options.socketOptions = {
        adapter: createAdapter(
          options.redisConnection.client().duplicate(),
          options.redisConnection.client().duplicate(),
        ),
      };
    }
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
