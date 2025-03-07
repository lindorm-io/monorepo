import { IAmphora } from "@lindorm/amphora";
import { ReadableTime } from "@lindorm/date";
import { Environment } from "@lindorm/enums";
import { ILogger } from "@lindorm/logger";
import { ILindormWorker } from "@lindorm/worker";
import Redis from "ioredis";
import { ServerOptions as SocketOptions } from "socket.io";
import { PylonListener, PylonRouter } from "../classes";
import { PylonCookieConfig } from "./cookies";
import { CorsOptions } from "./cors";
import { OpenIdConfigurationOptions } from "./open-id-configuration";
import { ParseBodyOptions } from "./parse-body";
import { PylonHttpContext, PylonHttpMiddleware } from "./pylon-context";
import { PylonSocketContext, PylonSocketMiddleware } from "./pylon-socket-context";
import { PylonSessionConfig } from "./session";
import { PylonSetup, PylonTeardown } from "./setup";

type HttpRouters<C extends PylonHttpContext> = { path: string; router: PylonRouter<C> };

export type PylonOptions<
  C extends PylonHttpContext = PylonHttpContext,
  S extends PylonSocketContext = PylonSocketContext,
> = {
  amphora: IAmphora;
  logger: ILogger;

  cookies?: PylonCookieConfig;
  cors?: CorsOptions;
  domain?: string;
  environment?: Environment;
  httpMaxRequestAge?: ReadableTime;
  httpMiddleware?: Array<PylonHttpMiddleware<C>>;
  httpRouters?: string | Array<HttpRouters<C>>;
  issuer?: string;
  name?: string;
  openIdConfiguration?: Partial<OpenIdConfigurationOptions>;
  parseBody?: ParseBodyOptions;
  port?: number;
  session?: PylonSessionConfig;
  setup?: PylonSetup;
  socketListeners?: string | Array<PylonListener<S>>;
  socketMiddleware?: Array<PylonSocketMiddleware<S>>;
  socketOptions?: Partial<SocketOptions>;
  socketRedis?: Redis;
  teardown?: PylonTeardown;
  version?: string;
  workers?: Array<ILindormWorker>;
};
