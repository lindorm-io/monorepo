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
import { IMongoFile, IMongoRepository, IMongoSource } from "../interfaces";

// common context

type Context = {
  entities: Dict<IEntity>;
  files: Array<IMongoFile>;
  repositories: {
    mongo: Dict<IMongoRepository<IEntity>>;
  };
  sources: {
    mongo: IMongoSource;
  };
};

// extended context

export type MongoPylonHttpContext<Data = any, WebhookData = any> = PylonHttpContext<
  Data,
  PylonHttpState,
  WebhookData
> &
  Context;

export type MongoPylonSocketContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContext<Args, Data> & Context;

// extended middleware

export type MongoPylonHttpMiddleware<
  C extends MongoPylonHttpContext = MongoPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type MongoPylonSocketMiddleware<
  C extends MongoPylonSocketContext = MongoPylonSocketContext,
> = PylonSocketMiddleware<C>;
