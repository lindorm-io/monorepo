import { IAegis, ParsedCws, ParsedCwt, ParsedJws, ParsedJwt } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { IConduit } from "@lindorm/conduit";
import { IHermes } from "@lindorm/hermes";
import { IIrisSource } from "@lindorm/iris";
import { ILogger } from "@lindorm/logger";
import { Middleware } from "@lindorm/middleware";
import { IEntity, IProteusSource } from "@lindorm/proteus";
import { Dict, Environment, Priority } from "@lindorm/types";
import { AuthorizationState } from "./authorization";
import { IoServer } from "./socket";

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

  hermes?: IHermes;
  iris?: IIrisSource;
  proteus?: IProteusSource;

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
  io: IoServer;
  params: Dict<string>;
  state: PylonState;
};

export type PylonMiddleware<C extends PylonContext = PylonContext> = Middleware<C>;
