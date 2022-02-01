import type { DefaultState, Middleware as KoaMiddleware } from "koa";
import type { KoaContext } from "./context";

export type { Next } from "koa";
export type Middleware<Context extends KoaContext> = KoaMiddleware<DefaultState, Context>;
