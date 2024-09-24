import {
  PylonEventContext,
  PylonEventMiddleware,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonSocketData,
} from "@lindorm/pylon";
import { Dict } from "@lindorm/types";
import { IMongoEntity, IMongoFile, IMongoSource } from "../interfaces";

// common context

type Context = {
  mongo: IMongoSource;
  entities: Dict<IMongoEntity>;
  files: Array<IMongoFile>;
};

// extended context

export type MongoPylonHttpContext<Data = any, WebhookData = any> = PylonHttpContext<
  Data,
  WebhookData
> &
  Context;

export type MongoPylonEventContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonEventContext<Args, Data> & Context;

// extended middleware

export type MongoPylonHttpMiddleware<
  C extends MongoPylonHttpContext = MongoPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type MongoPylonEventMiddleware<
  C extends MongoPylonEventContext = MongoPylonEventContext,
> = PylonEventMiddleware<C>;
