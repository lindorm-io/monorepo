import { DefaultLindormKoaContext } from "./koa-context";
import { DefaultState, Middleware as KoaMiddleware } from "koa";

export type DefaultLindormMiddleware<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
> = KoaMiddleware<DefaultState, Context>;
