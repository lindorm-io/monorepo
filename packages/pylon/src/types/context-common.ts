import { IAegis, ParsedCws, ParsedCwt, ParsedJws, ParsedJwt } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { IConduit } from "@lindorm/conduit";
import { IHermesSession } from "@lindorm/hermes";
import { IIrisSession } from "@lindorm/iris";
import { ILogger } from "@lindorm/logger";
import { Middleware } from "@lindorm/middleware";
import { IEntity, IProteusSession } from "@lindorm/proteus";
import { Dict, Environment, Priority } from "@lindorm/types";
import { AuthorizationState } from "./authorization";
import { PylonIoContextHttp } from "./pylon-io-context";
import { PylonSocketEmitter } from "./pylon-socket-emitter";

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
  app: AppState;
  authorization: AuthorizationState;
  metadata: PylonMetadata;
  tenant?: string | null;
  tokens: Dict<ParsedJwt | ParsedJws<any> | ParsedCwt | ParsedCws<any>>;
};

type Conduits = {
  conduit: IConduit;
  [key: string]: IConduit;
};

export type PylonCommonContext = {
  aegis: IAegis;
  amphora: IAmphora;
  conduits: Conduits;
  entities: Dict<IEntity>;
  logger: ILogger;

  repositories?: Dict;
  caches?: Dict;
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
  state: PylonState;
};

export type PylonMiddleware<C extends PylonContext = PylonContext> = Middleware<C>;
