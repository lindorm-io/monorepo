import { Environment } from "../enum";
import { IntervalWorker } from "../class";
import { KoaContext } from "./context";
import { Logger } from "@lindorm-io/winston";
import { Middleware } from "./koa";
import { Server } from "socket.io";
import { DefaultLindormSocketMiddleware } from "./socket";

export type CreateSocketListeners = (io: Server) => void;

export type HealthCallback<Context extends KoaContext> = (ctx: Context) => Promise<void>;

export type HeartbeatCallback<Context extends KoaContext> = (ctx: Context) => Promise<void>;

export type SetupCallback = () => Promise<void>;

export interface KoaAppOptions<Context extends KoaContext> {
  // required
  host: string;
  logger: Logger;
  port: number;

  // optional
  domain?: string;
  environment?: Environment;
  keys?: Array<string>;
  middleware?: Array<Middleware<any>>;
  routerDirectory?: string;
  socketMiddleware?: Array<DefaultLindormSocketMiddleware>;
  workers?: Array<IntervalWorker>;

  // functions
  createSocketListeners?: CreateSocketListeners;
  healthCallback?: HealthCallback<Context>;
  heartbeatCallback?: HeartbeatCallback<Context>;
  setup?: SetupCallback;
}
