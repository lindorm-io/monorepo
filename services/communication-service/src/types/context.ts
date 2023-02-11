import { Controller, DefaultLindormSocket } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import {
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
} from "@lindorm-io/node-server";

export type ServerKoaContext<D extends Dict = Dict> = LindormNodeServerKoaContext<
  LindormNodeServerContext,
  D
>;

export type ServerKoaController<D extends Dict = Dict> = Controller<ServerKoaContext<D>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;

export type ServerSocket<D extends Dict = Dict> = DefaultLindormSocket<LindormNodeServerContext, D>;
