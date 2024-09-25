import {
  PylonEventContext,
  PylonEventMiddleware,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonSocketData,
} from "@lindorm/pylon";
import { IPostgresSource } from "../interfaces";

// common context

type Context = {
  postgres: IPostgresSource;
};

// extended context

export type PostgresPylonHttpContext<Data = any, WebhookData = any> = PylonHttpContext<
  Data,
  WebhookData
> &
  Context;

export type PostgresPylonEventContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonEventContext<Args, Data> & Context;

// extended middleware

export type PostgresPylonHttpMiddleware<
  C extends PostgresPylonHttpContext = PostgresPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type PostgresPylonEventMiddleware<
  C extends PostgresPylonEventContext = PostgresPylonEventContext,
> = PylonEventMiddleware<C>;
