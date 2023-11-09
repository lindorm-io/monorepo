import { TransformMode } from "@lindorm-io/case";
import { Environment } from "@lindorm-io/common-enums";
import { Logger } from "@lindorm-io/core-logger";
import { ServerOptions } from "socket.io";
import { IntervalWorker } from "../class";
import { DefaultLindormMiddleware } from "./koa";
import { DefaultLindormKoaContext } from "./koa-context";
import { DefaultLindormSocketMiddleware, IOServer } from "./socket";

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
