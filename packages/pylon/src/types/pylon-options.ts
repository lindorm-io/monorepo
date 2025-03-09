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

export type PylonHttpRouters<C extends PylonHttpContext> = {
  path: string;
  router: PylonRouter<C>;
};

type Common = {
  amphora: IAmphora;
  logger: ILogger;
};

export type PylonHttpOptions<C extends PylonHttpContext = PylonHttpContext> = Common & {
  cookies?: PylonCookieConfig;
  cors?: CorsOptions;
  environment?: Environment;
  httpMiddleware?: Array<PylonHttpMiddleware<C>>;
  httpRouters?: string | Array<PylonHttpRouters<C>>;
  issuer?: string | null;
  maxRequestAge?: ReadableTime;
  openIdConfiguration?: Partial<OpenIdConfigurationOptions>;
  parseBody?: ParseBodyOptions;
  session?: PylonSessionConfig;
  version?: string;
};

export type PylonIoOptions<T extends PylonSocketContext = PylonSocketContext> = Common & {
  socketListeners?: string | Array<PylonListener<T>>;
  socketMiddleware?: Array<PylonSocketMiddleware<T>>;
  socketOptions?: Partial<SocketOptions>;
  socketRedis?: Redis;
};

export type PylonOptions<
  C extends PylonHttpContext = PylonHttpContext,
  S extends PylonSocketContext = PylonSocketContext,
> = PylonHttpOptions<C> &
  PylonIoOptions<S> & {
    domain?: string;
    name?: string;
    port?: number;
    setup?: PylonSetup;
    teardown?: PylonTeardown;
    workers?: Array<ILindormWorker>;
  };
