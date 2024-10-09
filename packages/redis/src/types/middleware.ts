import { IEntity } from "@lindorm/entity";
import {
  PylonEventContext,
  PylonEventMiddleware,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonSocketData,
} from "@lindorm/pylon";
import { Dict } from "@lindorm/types";
import { IRedisSource } from "../interfaces";

// common context

type Context = {
  redis: IRedisSource;
  entities: Dict<IEntity>;
};

// extended context

export type RedisPylonHttpContext<Data = any, WebhookData = any> = PylonHttpContext<
  Data,
  WebhookData
> &
  Context;

export type RedisPylonEventContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonEventContext<Args, Data> & Context;

// extended middleware

export type RedisPylonHttpMiddleware<
  C extends RedisPylonHttpContext = RedisPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type RedisPylonEventMiddleware<
  C extends RedisPylonEventContext = RedisPylonEventContext,
> = PylonEventMiddleware<C>;
