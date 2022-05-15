import { DefaultLindormKoaContext } from "./koa-context";
import { DefaultState, Middleware as KoaMiddleware } from "koa";

export type { Next } from "koa";
export type Middleware<Context extends DefaultLindormKoaContext = DefaultLindormKoaContext> =
  KoaMiddleware<DefaultState, Context>;
