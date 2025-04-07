import { IEntity } from "@lindorm/entity";
import {
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonHttpState,
  PylonSocketContext,
  PylonSocketData,
  PylonSocketMiddleware,
} from "@lindorm/pylon";
import { Dict } from "@lindorm/types";
import { IRedisRepository, IRedisSource } from "../interfaces";

// common context

type Context = {
  entities: Dict<IEntity>;
  repositories: {
    redis: Dict<IRedisRepository<IEntity>>;
  };
  sources: {
    redis: IRedisSource;
  };
};

// extended context

export type RedisPylonHttpContext<Data = any, WebhookData = any> = PylonHttpContext<
  Data,
  PylonHttpState,
  WebhookData
> &
  Context;

export type RedisPylonSocketContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContext<Args, Data> & Context;

// extended middleware

export type RedisPylonHttpMiddleware<
  C extends RedisPylonHttpContext = RedisPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type RedisPylonSocketMiddleware<
  C extends RedisPylonSocketContext = RedisPylonSocketContext,
> = PylonSocketMiddleware<C>;
