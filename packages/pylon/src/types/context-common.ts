import type { IAegis, ParsedJws, ParsedJwt } from "@lindorm/aegis";
import type { IAmphora } from "@lindorm/amphora";
import type { IConduit } from "@lindorm/conduit";
import type { IHermesSession } from "@lindorm/hermes";
import type { IIrisSession } from "@lindorm/iris";
import type { ILogger } from "@lindorm/logger";
import type { Middleware } from "@lindorm/middleware";
import type { IEntity, IProteusSession } from "@lindorm/proteus";
import type { Dict, Environment, Priority } from "@lindorm/types";
import type { AuthorizationState } from "./authorization.js";
import type { PylonAuthClaimsClient } from "./pylon-auth-client.js";
import type { PylonIoContextHttp } from "./pylon-io-context.js";
import type { PylonSocketEmitter } from "./pylon-socket-emitter.js";

export type AppState = {
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
  actor: string;
  app: AppState;
  authorization: AuthorizationState;
  metadata: PylonMetadata;
  tenant?: string | null;
  tokens: Dict<ParsedJwt | ParsedJws<any>>;
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
  iris?: IIrisSession;
  proteus?: IProteusSession;

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
