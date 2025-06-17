import {
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonHttpState,
  PylonSocketContext,
  PylonSocketData,
  PylonSocketMiddleware,
} from "@lindorm/pylon";
import { IRabbitSource } from "../interfaces";

// common context

type Context = {
  sources: {
    rabbit: IRabbitSource;
  };
};

// extended context

export type RabbitPylonHttpContext<Data = any> = PylonHttpContext<Data, PylonHttpState> &
  Context;

export type RabbitPylonSocketContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContext<Args, Data> & Context;

// extended middleware

export type RabbitPylonHttpMiddleware<
  C extends RabbitPylonHttpContext = RabbitPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type RabbitPylonSocketMiddleware<
  C extends RabbitPylonSocketContext = RabbitPylonSocketContext,
> = PylonSocketMiddleware<C>;
