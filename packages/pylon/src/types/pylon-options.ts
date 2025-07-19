import { IAmphora } from "@lindorm/amphora";
import { ReadableTime } from "@lindorm/date";
import { IEntity } from "@lindorm/entity";
import { Environment } from "@lindorm/types";
import { IHermes } from "@lindorm/hermes";
import { ILogger } from "@lindorm/logger";
import { IMessage } from "@lindorm/message";
import { RetryOptions } from "@lindorm/retry";
import { Constructor } from "@lindorm/types";
import { ILindormWorker, LindormWorkerConfig } from "@lindorm/worker";
import Redis from "ioredis";
import { ServerOptions as SocketOptions } from "socket.io";
import { PylonListener, PylonRouter } from "../classes";
import { PylonAuthOptions } from "./auth";
import { PylonHttpContext, PylonHttpMiddleware } from "./context-http";
import { PylonSocketContext, PylonSocketMiddleware } from "./context-socket";
import { PylonCookieConfig } from "./cookies";
import { CorsOptions } from "./cors";
import { OpenIdConfigurationOptions } from "./open-id-configuration";
import { ParseBodyOptions } from "./parse-body";
import {
  PylonHttpCallback,
  PylonQueueOptions,
  PylonSessionOptions,
  PylonWebhookOptions,
} from "./pylon-callback-options";
import { PylonSetup, PylonTeardown } from "./setup";
import { PylonSource } from "./sources";
import { PylonSubscribeOptions } from "./types";

export type PylonHttpRouters<C extends PylonHttpContext> = {
  path: string;
  router: PylonRouter<C>;
};

type CommonOptions = {
  amphora: IAmphora;
  domain?: string;
  entities?: Array<Constructor<IEntity>>;
  environment?: Environment;
  hermes?: IHermes;
  logger: ILogger;
  messages?: Array<Constructor<IMessage>>;
  name?: string;
  sources?: Array<PylonSource>;
  version?: string;
};

export type PylonHttpCallbacksOptions<C extends PylonHttpContext = PylonHttpContext> = {
  health?: PylonHttpCallback<C>;
  rightToBeForgotten?: PylonHttpCallback<C>;
};

export type PylonHttpOptions<C extends PylonHttpContext = PylonHttpContext> =
  CommonOptions & {
    auth?: PylonAuthOptions;
    callbacks?: PylonHttpCallbacksOptions<C>;
    changePasswordUri?: string;
    cookies?: PylonCookieConfig;
    cors?: CorsOptions;
    httpMiddleware?: Array<PylonHttpMiddleware<C>>;
    httpRouters?: string | Array<PylonHttpRouters<C>>;
    maxRequestAge?: ReadableTime;
    minRequestAge?: ReadableTime;
    openIdConfiguration?: Partial<OpenIdConfigurationOptions>;
    parseBody?: ParseBodyOptions;
    proxy?: boolean;
    queue?: PylonQueueOptions<C>;
    session?: PylonSessionOptions<C>;
    webhook?: PylonWebhookOptions<C>;
  };

export type PylonIoOptions<T extends PylonSocketContext = PylonSocketContext> =
  CommonOptions & {
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
    subscriptions?: Array<PylonSubscribeOptions>;
    workers?: Array<ILindormWorker | LindormWorkerConfig | string>;
    workersInterval?: ReadableTime;
    workersRetry?: RetryOptions;
  };
