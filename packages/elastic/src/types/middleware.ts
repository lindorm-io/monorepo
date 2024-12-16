import { IEntity } from "@lindorm/entity";
import {
  PylonEventContext,
  PylonEventMiddleware,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonSocketData,
} from "@lindorm/pylon";
import { Dict } from "@lindorm/types";
import { IElasticSource } from "../interfaces";

// common context

type Context = {
  elastic: IElasticSource;
  entities: Dict<IEntity>;
};

// extended context

export type ElasticPylonHttpContext<Data = any, WebhookData = any> = PylonHttpContext<
  Data,
  WebhookData
> &
  Context;

export type ElasticPylonEventContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonEventContext<Args, Data> & Context;

// extended middleware

export type ElasticPylonHttpMiddleware<
  C extends ElasticPylonHttpContext = ElasticPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type ElasticPylonEventMiddleware<
  C extends ElasticPylonEventContext = ElasticPylonEventContext,
> = PylonEventMiddleware<C>;
