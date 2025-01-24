import {
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonSocketContext,
  PylonSocketData,
  PylonSocketMiddleware,
} from "@lindorm/pylon";
import { IHermes } from "../interfaces";

// common context

type Context = {
  hermes: IHermes;
};

// extended context

export type HermesPylonHttpContext<Data = any, WebhookData = any> = PylonHttpContext<
  Data,
  WebhookData
> &
  Context;

export type HermesPylonSocketContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContext<Args, Data> & Context;

// extended middleware

export type HermesPylonHttpMiddleware<
  C extends HermesPylonHttpContext = HermesPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type HermesPylonSocketMiddleware<
  C extends HermesPylonSocketContext = HermesPylonSocketContext,
> = PylonSocketMiddleware<C>;
