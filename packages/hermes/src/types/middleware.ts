import {
  PylonEventContext,
  PylonEventMiddleware,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonSocketData,
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

export type HermesPylonEventContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonEventContext<Args, Data> & Context;

// extended middleware

export type HermesPylonHttpMiddleware<
  C extends HermesPylonHttpContext = HermesPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type HermesPylonEventMiddleware<
  C extends HermesPylonEventContext = HermesPylonEventContext,
> = PylonEventMiddleware<C>;
