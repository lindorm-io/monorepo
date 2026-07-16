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
import type { PylonListener, PylonRouter } from "../../classes/index.js";
import type { PylonAuthSettings } from "./auth-settings.js";
import type { PylonCommonContext } from "../context/context-common.js";
import type {
  PylonConnectionMiddleware,
  PylonSocketHandshakeContext,
} from "../context/context-socket-handshake.js";
import type { PylonHttpContext, PylonHttpMiddleware } from "../context/context-http.js";
import type {
  PylonSocketContext,
  PylonSocketMiddleware,
} from "../context/context-socket.js";
import type { PylonEventMap } from "../socket/pylon-event-map.js";
import type { PylonCookieSettings } from "./cookie-settings.js";
import type { PylonCorsSettings } from "./cors.js";
import type { PylonOpenIdConfigurationSettings } from "./open-id-configuration.js";
import type { PylonParseBodySettings } from "../http/parse-body.js";
import type {
  PylonAuditSettings,
  PylonCacheSettings,
  PylonKryptosSettings,
  PylonQueueSettings,
  PylonRateLimitSettings,
  PylonRoomsSettings,
  PylonWebhookSettings,
} from "./feature-settings.js";
import type { PylonHttpCallback } from "../http/callbacks.js";
import type { PylonSessionSettings } from "./session-settings.js";

import type { PylonSecurityTxt } from "./security-txt.js";
import type { PylonSetup, PylonTeardown } from "./setup.js";
import type { PylonSubscribeSettings } from "./subscribe-settings.js";

export type PylonHttpRouters<C extends PylonHttpContext> = {
  path: string;
  router: PylonRouter<C>;
};

type PylonCommonSettings = {
  actor?: (ctx: PylonCommonContext) => string;
  amphora: IAmphora;
  audit?: PylonAuditSettings;
  cache?: PylonCacheSettings;
  domain?: string;
  environment?: Environment;
  hermes?: IHermes;
  bus?: IIrisSource;
  /**
   * Ephemeral / in-memory storage source (redis in production, a proteus
   * memory-driver source in dev/test). Backs ephemeral features (rate limit,
   * session, rooms) and is exposed per-request as `ctx.kv`.
   */
  kv?: IProteusSource;
  logger: ILogger;
  name?: string;
  db?: IProteusSource;
  queue?: PylonQueueSettings;
  rateLimit?: PylonRateLimitSettings;
  rooms?: PylonRoomsSettings;
  version?: string;
  webhook?: PylonWebhookSettings;
};

export type PylonHttpCallbacksSettings<C extends PylonHttpContext = PylonHttpContext> = {
  /**
   * Liveness (`/health`). Default: check I/O once then latch success. Provide a
   * custom callback to add a lightweight liveness check, or `null` for a pure 204.
   */
  health?: PylonHttpCallback<C> | null;
  /**
   * Readiness (`/ready`). Default: ping live I/O (proteus/iris) on every call.
   * Provide a custom callback, or `null` for a pure 204.
   */
  ready?: PylonHttpCallback<C> | null;
  rightToBeForgotten?: PylonHttpCallback<C>;
};

export type PylonHttpSettings<C extends PylonHttpContext = PylonHttpContext> =
  PylonCommonSettings & {
    auth?: PylonAuthSettings;
    callbacks?: PylonHttpCallbacksSettings<C>;
    changePasswordUri?: string;
    cookies?: PylonCookieSettings;
    cors?: PylonCorsSettings;
    httpMiddleware?: Array<PylonHttpMiddleware<C>>;
    routes?: string | PylonHttpRouters<C> | Array<string | PylonHttpRouters<C>>;
    maxRequestAge?: ReadableTime;
    minRequestAge?: ReadableTime;
    openIdConfiguration?: Partial<PylonOpenIdConfigurationSettings>;
    parseBody?: PylonParseBodySettings;
    proxy?: boolean;
    securityTxt?: PylonSecurityTxt;
    session?: PylonSessionSettings;
  };

export type PylonSocketSettings<
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

export type PylonSettings<
  _E extends PylonEventMap = PylonEventMap,
  C extends PylonHttpContext = PylonHttpContext,
  S extends PylonSocketContext = PylonSocketContext,
> = PylonHttpSettings<C> & {
  socket?: PylonSocketSettings<S>;
  kryptos?: PylonKryptosSettings;
  port?: number;
  setup?: PylonSetup;
  teardown?: PylonTeardown;
  subscriptions?: Array<PylonSubscribeSettings>;
  workers?: string | ILindormWorker | Array<ILindormWorker | string>;
};
