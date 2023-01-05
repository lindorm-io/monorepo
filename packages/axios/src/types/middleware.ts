import { Context } from "./context";

export type Dispatch = (i: number) => Promise<void>;
export type Next = () => Promise<void>;
export type Middleware = (ctx: Context, next: Next) => Promise<void>;
export type ComposedMiddleware = (ctx: Context, next?: Next) => Promise<void>;
