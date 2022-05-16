import { CreateNodeServerOptions, LindormNodeServerKoaContext } from "../types";
import { axiosMiddleware, socketAxiosMiddleware } from "@lindorm-io/koa-axios";
import { socketTokenIssuerMiddleware, tokenIssuerMiddleware } from "@lindorm-io/koa-jwt";
import { DefaultLindormMiddleware, DefaultLindormSocketMiddleware, KoaApp } from "@lindorm-io/koa";
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

  if (options.mongoConnection) {
    middleware.push(mongoMiddleware(options.mongoConnection));
    socketMiddleware.push(socketMongoMiddleware(options.mongoConnection));

    for (const Repository of options.repositories || []) {
      middleware.push(repositoryMiddleware(Repository));
      socketMiddleware.push(socketRepositoryMiddleware(Repository));
    }

    if (options.isKeyPairInRepository) {
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

    if (options.isKeyPairCached) {
      middleware.push(cacheMiddleware(KeyPairCache));
      socketMiddleware.push(socketCacheMiddleware(KeyPairCache));

      middleware.push(cacheKeysMiddleware);
      socketMiddleware.push(socketCacheKeysMiddleware);

      middleware.push(keystoreMiddleware);
      socketMiddleware.push(socketKeystoreMiddleware);

      middleware.push(tokenIssuerMiddleware({ issuer: options.host }));
      socketMiddleware.push(socketTokenIssuerMiddleware({ issuer: options.host }));
    }
  }

  for (const item of options.middleware || []) {
    middleware.push(item);
  }

  for (const item of options.socketMiddleware || []) {
    socketMiddleware.push(item);
  }

  return new KoaApp<Context>({ ...options, middleware, socketMiddleware });
};
