import {
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonSocketContext,
  PylonSocketData,
  PylonSocketMiddleware,
} from "@lindorm/pylon";
import { Dict } from "@lindorm/types";
import { IElasticEntity, IElasticRepository, IElasticSource } from "../interfaces";

// common context

type Context = {
  entities: Dict<{ id: string }>;
  repositories: {
    elastic: Dict<IElasticRepository<IElasticEntity>>;
  };
  sources: {
    elastic: IElasticSource;
  };
};

// extended context

export type ElasticPylonHttpContext<Data = any, WebhookData = any> = PylonHttpContext<
  Data,
  WebhookData
> &
  Context;

export type ElasticPylonSocketContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContext<Args, Data> & Context;

// extended middleware

export type ElasticPylonHttpMiddleware<
  C extends ElasticPylonHttpContext = ElasticPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type ElasticPylonSocketMiddleware<
  C extends ElasticPylonSocketContext = ElasticPylonSocketContext,
> = PylonSocketMiddleware<C>;
