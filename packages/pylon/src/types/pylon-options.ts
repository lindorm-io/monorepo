import { IAmphora } from "@lindorm/amphora";
import { ReadableTime } from "@lindorm/date";
import { Environment } from "@lindorm/enums";
import { ILogger } from "@lindorm/logger";
import { RetryOptions } from "@lindorm/retry";
import { ILindormWorker, LindormWorkerConfig } from "@lindorm/worker";
import Redis from "ioredis";
import { ServerOptions as SocketOptions } from "socket.io";
import { PylonListener, PylonRouter } from "../classes";
import { PylonAuthOptions } from "./auth";
import { PylonCookieConfig } from "./cookies";
import { CorsOptions } from "./cors";
import { OpenIdConfigurationOptions } from "./open-id-configuration";
import {
  OptionsHandler,
  OptionsQueueHandler,
  OptionsWebhookHandler,
} from "./options-handler";
import { ParseBodyOptions } from "./parse-body";
import { PylonHttpContext, PylonHttpMiddleware } from "./pylon-http-context";
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

type Handlers<C extends PylonHttpContext = PylonHttpContext> = {
  health?: OptionsHandler<C>;
  queue?: OptionsQueueHandler<C>;
  rightToBeForgotten?: OptionsHandler<C>;
  webhook?: OptionsWebhookHandler<C>;
};

export type PylonHttpOptions<C extends PylonHttpContext = PylonHttpContext> = Common & {
  auth?: PylonAuthOptions;
  changePasswordUri?: string;
  cookies?: PylonCookieConfig;
  cors?: CorsOptions;
  domain?: string;
  environment?: Environment;
  handlers?: Handlers<C>;
  httpMiddleware?: Array<PylonHttpMiddleware<C>>;
  httpRouters?: string | Array<PylonHttpRouters<C>>;
  minRequestAge?: ReadableTime;
  maxRequestAge?: ReadableTime;
  name?: string;
  openIdConfiguration?: Partial<OpenIdConfigurationOptions>;
  parseBody?: ParseBodyOptions;
  proxy?: boolean;
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
    port?: number;
    setup?: PylonSetup;
    teardown?: PylonTeardown;
    workers?: Array<ILindormWorker | LindormWorkerConfig | string>;
    workersInterval?: ReadableTime;
    workersRetry?: RetryOptions;
  };
