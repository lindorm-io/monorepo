import { IAegis, VerifiedJws, VerifiedJwt } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { IConduit } from "@lindorm/conduit";
import { Environment } from "@lindorm/enums";
import { ILogger } from "@lindorm/logger";
import { Middleware } from "@lindorm/middleware";
import { Dict } from "@lindorm/types";
import { Files } from "formidable";
import { BaseRequest } from "koa";
import { RouterContext } from "koa-router";
import { IPylonCookies, IPylonSession } from "../interfaces";
import { PylonSession } from "./session";
import { IoServer } from "./socket";

type KoaContext = Omit<RouterContext, "cookies" | "state">;

type Conduits = {
  conduit: IConduit;
  [key: string]: IConduit;
};

type Metadata = {
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

type Webhook<Data> = {
  event: string | null;
  data: Data;
};

export type PylonHttpState = {
  metadata: Metadata;
  session: PylonSession | null;
  tokens: Dict<VerifiedJwt | VerifiedJws<any>>;
};

type Context<Data, State, WebhookData> = {
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
  webhook: Webhook<WebhookData>;
};

export type PylonHttpContext<
  Data = any,
  State extends PylonHttpState = PylonHttpState,
  WebhookData = any,
> = KoaContext & Context<Data, State, WebhookData>;

export type PylonHttpMiddleware<C extends PylonHttpContext = PylonHttpContext> =
  Middleware<C>;
