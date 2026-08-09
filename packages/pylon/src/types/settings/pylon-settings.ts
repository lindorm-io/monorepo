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
import type { PylonParseBodySettings } from "../http/parse-body.js";
import type {
  PylonAuditSettings,
  PylonKryptosSettings,
  PylonQueueSettings,
  PylonRateLimitSettings,
  PylonRoomsSettings,
  PylonWebhookSettings,
} from "./feature-settings.js";
import type { PylonHttpCallback } from "../http/callbacks.js";

import type { PylonSecurityTxt } from "./security-txt.js";
import type { PylonSetup, PylonTeardown } from "./setup.js";
import type { PylonSubscribeSettings } from "./subscribe-settings.js";

export type PylonHttpRouters<C extends PylonHttpContext> = {
  path: string;
  router: PylonRouter<C>;
};

/**
 * Pylon takes FOUR sources and no per-feature overrides. Which one a feature
 * lands in is fixed, and the split criterion is a single question: **is eviction
 * under memory pressure acceptable for this data?** — the same question a redis
 * `maxmemory-policy` answers.
 *
 * - **`db`** — durable, relational. Backs `kryptos`, `webhook`, `audit`.
 *   Per-request as `ctx.db`.
 * - **`kv`** — authoritative ephemeral storage that must NOT be evicted
 *   (`noeviction`). Backs `session` and `rooms` presence, and is what an auth
 *   driver is handed as `ctx.kv`. Per-request as `ctx.kv`.
 * - **`cache`** — evictable ephemeral storage (`allkeys-lru`). Backs the response
 *   cache, the driver-response caches and the rate-limit counters. **Defaults to
 *   `kv` when unset**, so a single-instance deployment configures one source and
 *   nothing changes for it.
 * - **`bus`** — messaging. Backs `queue`, `webhook` dispatch and `audit`
 *   publication. Per-request as `ctx.bus`.
 *
 * Splitting `cache` off `kv` exists because two populations with opposite needs
 * were sharing one instance: evicting a `Session` to make room for a rate-limit
 * bucket logs a user out on a traffic spike.
 *
 * ⚠ `auth` (and the `auth.session` inside it) is COMMON, not http. Both are read
 * by the SOCKET path as much as the http one: the handshake token middleware has
 * a `source.kind === "session"` branch that reads the session and installs the
 * refresh handler, and handshake token verification needs the driver's
 * `endpoints().issuer`. Declaring them under the http-flavoured type would tell
 * the next reader they are http-only, which is false. `auth.router` — the
 * login / callback / logout routes — genuinely IS http-only, but it stays inside
 * the `auth` block: routes that never mount without http are ordinary inert
 * config, and splitting `auth` across two homes costs more than it explains.
 */
type PylonCommonSettings = {
  actor?: (ctx: PylonCommonContext) => string;
  amphora: IAmphora;
  audit?: PylonAuditSettings;
  auth?: PylonAuthSettings;
  bus?: IIrisSource;
  /** Evictable ephemeral source (`allkeys-lru`). Defaults to `kv` when unset. */
  cache?: IProteusSource;
  db?: IProteusSource;
  domain?: string;
  environment?: Environment;
  hermes?: IHermes;
  /** Authoritative ephemeral source (`noeviction`) — never evict what lives here. */
  kv?: IProteusSource;
  logger: ILogger;
  name?: string;
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
    callbacks?: PylonHttpCallbacksSettings<C>;
    changePasswordUri?: string;
    cookies?: PylonCookieSettings;
    cors?: PylonCorsSettings;
    httpMiddleware?: Array<PylonHttpMiddleware<C>>;
    routes?: string | PylonHttpRouters<C> | Array<string | PylonHttpRouters<C>>;
    maxRequestAge?: ReadableTime;
    minRequestAge?: ReadableTime;
    parseBody?: PylonParseBodySettings;
    proxy?: boolean;
    securityTxt?: PylonSecurityTxt;
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
  /**
   * The interface to bind. Default is the WILDCARD — a container needs to accept
   * traffic from outside its own namespace, so a server should.
   *
   * Name one to bind a single interface: `127.0.0.1` for a pylon reached only
   * through a sidecar proxy on the same host, and for tests. ⚠ A wildcard bind
   * does NOT conflict with a pre-existing `127.0.0.1`-specific listener on BSD
   * and macOS, so the kernel can hand out a port another process already owns and
   * longest-prefix routing then delivers `127.0.0.1` traffic to THAT process.
   * Binding the address the client dials turns that into `EADDRINUSE` at boot.
   */
  host?: string;
  port?: number;
  setup?: PylonSetup;
  teardown?: PylonTeardown;
  /**
   * Bus subscriptions bound at boot, alongside Pylon's own audit and webhook
   * consumers. Each names the `@Message` class it reads with, and Pylon registers
   * that class on `bus` before the source sets up.
   *
   * Requires `bus`. Declaring a subscription without one is a boot failure
   * (`subscriptions_bus_not_configured`), for the same reason the audit and
   * webhook blocks are: a subscriber that cannot be bound is silence, and a
   * deployment reads silence as "no traffic".
   *
   * ⚠ `<any>` rather than the default `<IMessage>`: `IMessage` is an EMPTY
   * interface, so under `strictFunctionTypes` a callback typed to the
   * deployment's own message class fails the contravariance check against it and
   * every declaration would need a cast. The element type stays exact wherever
   * its own `M` is named.
   */
  subscriptions?: Array<PylonSubscribeSettings<any>>;
  workers?: string | ILindormWorker | Array<ILindormWorker | string>;
};
