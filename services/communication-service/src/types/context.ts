import { Controller, DefaultLindormSocket } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import {
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
} from "@lindorm-io/node-server";

export interface ServerKoaContext<D extends Dict = Dict>
  extends LindormNodeServerKoaContext<LindormNodeServerContext, D> {}

export interface ServerKoaController<D extends Dict = Dict>
  extends Controller<ServerKoaContext<D>> {}

export interface ServerKoaMiddleware extends LindormNodeServerKoaMiddleware<ServerKoaContext> {}

export interface ServerSocket<D extends Dict = Dict>
  extends DefaultLindormSocket<LindormNodeServerContext, D> {}
