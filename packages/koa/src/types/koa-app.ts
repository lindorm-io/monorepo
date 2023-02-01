import { DefaultLindormKoaContext } from "./koa-context";
import { DefaultLindormMiddleware } from "./koa";
import { DefaultLindormSocketMiddleware, IOServer } from "./socket";
import { Environment } from "../enum";
import { IntervalWorker } from "../class";
import { Logger } from "@lindorm-io/core-logger";
import { ServerOptions } from "socket.io";
import { TransformMode } from "@lindorm-io/case";

export type SocketListeners = (io: IOServer) => void;

export type HealthCallback<Context extends DefaultLindormKoaContext> = (
  ctx: Context,
) => Promise<void>;

export type HeartbeatCallback<Context extends DefaultLindormKoaContext> = (
  ctx: Context,
) => Promise<void>;

export type SetupCallback = () => Promise<void>;

export interface KoaAppOptions<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
> {
  // required
  host: string;
  logger: Logger;
  port: number;

  // optional
  domain?: string;
  environment?: Environment;
  keys?: Array<string>;
  middleware?: Array<DefaultLindormMiddleware<any>>;
  routerDirectory?: string;
  socket?: boolean;
  socketMiddleware?: Array<DefaultLindormSocketMiddleware>;
  socketOptions?: Partial<ServerOptions>;
  transformMode?: TransformMode;
  workers?: Array<IntervalWorker>;

  // functions
  socketListeners?: SocketListeners;
  healthCallback?: HealthCallback<Context>;
  heartbeatCallback?: HeartbeatCallback<Context>;
  setup?: SetupCallback;
}
