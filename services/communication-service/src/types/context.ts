import { Controller, DefaultLindormSocket } from "@lindorm-io/koa";
import {
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
} from "@lindorm-io/node-server";

export type ServerKoaContext<Data = any> = LindormNodeServerKoaContext<
  LindormNodeServerContext,
  Data
>;

export type ServerKoaController<Data = any> = Controller<ServerKoaContext<Data>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;

export type ServerSocket<Data = any> = DefaultLindormSocket<LindormNodeServerContext, Data>;
