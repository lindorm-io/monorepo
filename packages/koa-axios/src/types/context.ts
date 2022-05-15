import { Axios } from "@lindorm-io/axios";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

interface Context extends DefaultLindormContext {
  axios: Record<string, Axios>;
}

export type DefaultLindormAxiosKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<Context>
>;

export type DefaultLindormAxiosSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<Context>
>;
