import type { IAmphora } from "@lindorm/amphora";
import type { ReadableTime } from "@lindorm/date";
import type { IHermes } from "@lindorm/hermes";
import type { IIrisSource } from "@lindorm/iris";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";
import type { Environment } from "@lindorm/types";
import type { ILindormWorker } from "@lindorm/worker";
import type { Redis } from "ioredis";
import type { ServerOptions as SocketOptions } from "socket.io";
import { PylonListener, PylonRouter } from "../classes/index.js";
import type { PylonAuthOptions } from "./auth.js";
import type {
  PylonConnectionMiddleware,
  PylonSocketHandshakeContext,
} from "./context-socket-handshake.js";
import type { PylonHttpContext, PylonHttpMiddleware } from "./context-http.js";
import type { PylonSocketContext, PylonSocketMiddleware } from "./context-socket.js";
import type { PylonEventMap } from "./pylon-event-map.js";
import type { PylonCookieConfig } from "./cookies.js";
import type { CorsOptions } from "./cors.js";
import type { OpenIdConfigurationOptions } from "./open-id-configuration.js";
import type { ParseBodyOptions } from "./parse-body.js";
import type {
  PylonAuditOptions,
  PylonHttpCallback,
  PylonKryptosOptions,
  PylonQueueOptions,
  PylonRateLimitOptions,
  PylonRoomsOptions,
  PylonSessionOptions,
  PylonWebhookOptions,
} from "./pylon-callback-options.js";

import type { PylonSecurityTxt } from "./security-txt.js";
import type { PylonSetup, PylonTeardown } from "./setup.js";
import type { PylonSubscribeOptions } from "./types.js";

export type PylonHttpRouters<C extends PylonHttpContext> = {
  path: string;
  router: PylonRouter<C>;
};

type CommonOptions = {
  amphora: IAmphora;
  audit?: PylonAuditOptions;
  domain?: string;
  environment?: Environment;
  hermes?: IHermes;
  iris?: IIrisSource;
  logger: ILogger;
  name?: string;
  proteus?: IProteusSource;
  queue?: PylonQueueOptions;
  rateLimit?: PylonRateLimitOptions;
  rooms?: PylonRoomsOptions;
  version?: string;
  webhook?: PylonWebhookOptions;
};

export type PylonHttpCallbacksOptions<C extends PylonHttpContext = PylonHttpContext> = {
  health?: PylonHttpCallback<C> | null;
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
    routes?: string | PylonHttpRouters<C> | Array<string | PylonHttpRouters<C>>;
    maxRequestAge?: ReadableTime;
    minRequestAge?: ReadableTime;
    openIdConfiguration?: Partial<OpenIdConfigurationOptions>;
    parseBody?: ParseBodyOptions;
    proxy?: boolean;
    securityTxt?: PylonSecurityTxt;
    session?: PylonSessionOptions;
  };

export type PylonSocketOptions<
  T extends PylonSocketContext = PylonSocketContext,
  H extends PylonSocketHandshakeContext = PylonSocketHandshakeContext,
> = {
  enabled: boolean;
  connectionMiddleware?: Array<PylonConnectionMiddleware<H>>;
  listeners?: string | PylonListener<T> | Array<string | PylonListener<T>>;
  middleware?: Array<PylonSocketMiddleware<T>>;
  options?: Partial<SocketOptions>;
  redis?: Redis;
};

export type PylonOptions<
  _E extends PylonEventMap = PylonEventMap,
  C extends PylonHttpContext = PylonHttpContext,
  S extends PylonSocketContext = PylonSocketContext,
> = PylonHttpOptions<C> & {
  socket?: PylonSocketOptions<S>;
  kryptos?: PylonKryptosOptions;
  port?: number;
  setup?: PylonSetup;
  teardown?: PylonTeardown;
  subscriptions?: Array<PylonSubscribeOptions>;
  workers?: string | ILindormWorker | Array<ILindormWorker | string>;
};
