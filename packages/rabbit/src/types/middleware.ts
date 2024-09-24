import {
  PylonEventContext,
  PylonEventMiddleware,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonSocketData,
} from "@lindorm/pylon";
import { IRabbitSource } from "../interfaces";

// common context

type Context = {
  rabbit: IRabbitSource;
};

// extended context

export type RabbitPylonHttpContext<Data = any, WebhookData = any> = PylonHttpContext<
  Data,
  WebhookData
> &
  Context;

export type RabbitPylonEventContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonEventContext<Args, Data> & Context;

// extended middleware

export type RabbitPylonHttpMiddleware<
  C extends RabbitPylonHttpContext = RabbitPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type RabbitPylonEventMiddleware<
  C extends RabbitPylonEventContext = RabbitPylonEventContext,
> = PylonEventMiddleware<C>;
