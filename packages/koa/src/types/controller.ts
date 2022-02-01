import { KoaContext } from "./context";
import { RecordAny } from "./util";

export type ControllerResponse<Body = RecordAny> = Promise<{
  body?: Body;
  redirect?: URL | string;
  status?: number;
}>;

export type Controller<Context extends KoaContext = KoaContext, Body = RecordAny> = (
  ctx: Context,
) => ControllerResponse<Body>;
