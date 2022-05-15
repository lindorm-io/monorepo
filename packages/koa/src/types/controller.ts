import { DefaultLindormKoaContext } from "./koa-context";

export type ControllerResponse<Body extends Record<string, any> = Record<string, any>> = Promise<{
  body?: Body;
  redirect?: URL | string;
  status?: number;
}>;

export type Controller<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
  Body extends Record<string, any> = Record<string, any>,
> = (ctx: Context) => ControllerResponse<Body>;
