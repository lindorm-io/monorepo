import type { IAegis, VerifiedToken } from "@lindorm/aegis";
import type { IAmphora } from "@lindorm/amphora";
import type { IConduit } from "@lindorm/conduit";
import type { IHermesSession } from "@lindorm/hermes";
import type { IIrisSession } from "@lindorm/iris";
import type { ILogger } from "@lindorm/logger";
import type { Middleware } from "@lindorm/middleware";
import type { IEntity, IProteusSession } from "@lindorm/proteus";
import type { Dict, Environment, Priority } from "@lindorm/types";
import type { AuthorizationState } from "../http/authorization.js";
import type { PylonAuthClaimsClient } from "../http/pylon-auth-client.js";
import type { PylonClientContext } from "./pylon-client-context.js";
import type { PylonIoContextHttp } from "./pylon-io-context.js";
import type { PylonResolvedAccess } from "./pylon-resolved-access.js";
import type { PylonSocketEmitter } from "../socket/pylon-socket-emitter.js";
import type { AppConfig } from "./app-config.js";

export type AppState = {
  /**
   * The deployment's resolved configuration and policy — the same deeply frozen
   * object on every request of both transports. The other members are ambient
   * IDENTITY, which is why they sit beside it rather than inside it.
   */
  readonly config: AppConfig;
  domain: string;
  environment: Environment;
  name: string;
  version: string;
};

export type PylonMetadata = {
  id: string;
  correlationId: string;
  date: Date;
  environment: Environment;
};

export type PylonHttpMetadata = PylonMetadata & {
  responseId: string;
  sessionId: string | null;
  origin: string | null;
};

export type PylonState = {
  /**
   * The resolved access credential, or `null` until `createAccessTokenMiddleware`
   * has run. COEXISTS with `tokens`: `tokens` is the session's token set keyed by
   * NAME (id, refresh, …), `access` is the single credential this request
   * authenticated with — which on the introspected path has no `VerifiedToken` at
   * all, so it could never live in `tokens`.
   */
  access: PylonResolvedAccess | null;
  actor: string;
  app: AppState;
  authorization: AuthorizationState;
  client: PylonClientContext;
  metadata: PylonMetadata;
  tenant?: string | null;
  tokens: Dict<VerifiedToken>;
};

type Conduits = {
  conduit: IConduit;
  [key: string]: IConduit;
};

export type PylonCommonContext = {
  aegis: IAegis;
  amphora: IAmphora;
  auth: PylonAuthClaimsClient;
  conduits: Conduits;
  entities: Dict<IEntity>;
  logger: ILogger;
  state: PylonState;

  publishers?: Dict;
  workerQueues?: Dict;

  hermes?: IHermesSession;
  bus?: IIrisSession;
  /**
   * The EVICTABLE ephemeral session (`allkeys-lru`) — throwaway data whose loss
   * costs at most a recomputation. It exists so a consumer needing a scratch
   * cache does not reach for `ctx.kv` and put evictable churn in the
   * `noeviction` instance, which is the exact failure the source split prevents:
   * a rate-limit bucket must never be able to push a `Session` out.
   *
   * Falls back to the `kv` source when the deployment configured no `cache`, so
   * a single-store deployment still gets a working `ctx.cache`. Even then it is
   * its OWN session, never `ctx.kv` itself — session identity stays the same
   * whether or not the stores are split, so splitting them later changes no
   * consumer code. Writes are visible across both: a session is a lightweight
   * handle over the source's shared pool, not an isolated transaction.
   */
  cache?: IProteusSession;
  kv?: IProteusSession;
  db?: IProteusSession;

  queue: (
    event: string,
    payload: Dict,
    priority?: Priority,
    optional?: boolean,
  ) => Promise<void>;

  webhook: (event: string, data?: any, optional?: boolean) => Promise<void>;
};

export type PylonContext = PylonCommonContext & {
  data: any;
  io: PylonIoContextHttp;
  params: Dict<string>;
  socket?: PylonSocketEmitter;
};

export type PylonMiddleware<C extends PylonContext = PylonContext> = Middleware<C>;
