import {
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonHttpState,
  PylonSocketContext,
  PylonSocketData,
  PylonSocketMiddleware,
} from "@lindorm/pylon";
import { IPostgresSource } from "../interfaces";

// common context

type Context = {
  sources: {
    postgres: IPostgresSource;
  };
};

// extended context

export type PostgresPylonHttpContext<Data = any, WebhookData = any> = PylonHttpContext<
  Data,
  PylonHttpState,
  WebhookData
> &
  Context;

export type PostgresPylonSocketContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContext<Args, Data> & Context;

// extended middleware

export type PostgresPylonHttpMiddleware<
  C extends PostgresPylonHttpContext = PostgresPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type PostgresPylonSocketMiddleware<
  C extends PostgresPylonSocketContext = PostgresPylonSocketContext,
> = PylonSocketMiddleware<C>;
