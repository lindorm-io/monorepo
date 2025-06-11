import { IAegis, ParsedCws, ParsedCwt, ParsedJws, ParsedJwt } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { IConduit } from "@lindorm/conduit";
import { Environment } from "@lindorm/enums";
import { ILogger } from "@lindorm/logger";
import { Middleware } from "@lindorm/middleware";
import { Dict } from "@lindorm/types";
import { Files } from "formidable";
import { BaseRequest } from "koa";
import { RouterContext } from "koa-router";
import { PylonMetric } from "../classes/private";
import { IPylonCookies, IPylonSession } from "../interfaces";
import { AuthorizationState } from "./authorization-state";
import { PylonSession } from "./session";
import { IoServer } from "./socket";

type KoaContext = Omit<RouterContext, "cookies" | "state">;

type Conduits = {
  conduit: IConduit;
  [key: string]: IConduit;
};

export type AppState = {
  environment: Environment;
  name: string;
  version: string;
};

export type MetadataState = {
  correlationId: string;
  date: Date;
  environment: Environment;
  origin: string | null;
  requestId: string;
  responseId: string;
  sessionId: string | null;
};

type Request = BaseRequest & {
  body?: any;
  files?: Files;
  raw?: any;
};

type Webhook<Data = any> = {
  event: string;
  data: Data;
};

export type PylonHttpState = {
  app: AppState;
  authorization: AuthorizationState;
  metadata: MetadataState;
  session: PylonSession | null;
  tokens: Dict<ParsedJwt | ParsedJws<any> | ParsedCwt | ParsedCws<any>>;
  webhooks: Array<Webhook>;
};

type Context<Data, State> = {
  aegis: IAegis;
  amphora: IAmphora;
  conduits: Conduits;
  cookies: IPylonCookies;
  data: Data;
  io: IoServer;
  logger: ILogger;
  request: Request;
  session: IPylonSession;
  state: State;

  metric: (name: string) => PylonMetric;
  webhook: (event: string, data?: any) => void;
};

export type PylonHttpContext<
  Data = any,
  State extends PylonHttpState = PylonHttpState,
> = KoaContext & Context<Data, State>;

export type PylonHttpMiddleware<C extends PylonHttpContext = PylonHttpContext> =
  Middleware<C>;
