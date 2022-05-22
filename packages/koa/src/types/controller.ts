import { DefaultLindormKoaContext } from "./koa-context";

interface ResponseObject<Body extends Record<string, any> = Record<string, any>> {
  body?: Body;
  redirect?: URL | string;
  status?: number;
}

export type ControllerResponse<Body extends Record<string, any> = Record<string, any>> =
  Promise<ResponseObject<Body> | void>;

export type Controller<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
  Body extends Record<string, any> = Record<string, any>,
> = (ctx: Context) => ControllerResponse<Body>;
