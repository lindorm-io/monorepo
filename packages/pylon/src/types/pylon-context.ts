import { IAegis, VerifiedJws, VerifiedJwt } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { IConduit } from "@lindorm/conduit";
import { Environment } from "@lindorm/enums";
import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { Files } from "formidable";
import { BaseRequest, DefaultState, Middleware } from "koa";
import { RouterContext } from "koa-router";
import { UserAgentContext } from "koa-useragent";
import UserAgent from "koa-useragent/dist/lib/useragent";
import { GetCookieOptions, SetCookieOptions } from "./cookies";
import { PylonSession } from "./session";
import { IoServer } from "./socket";

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

type Context<Data, WebhookData> = {
  aegis: IAegis;
  amphora: IAmphora;
  conduits: Conduits;
  data: Data;
  io: IoServer;
  logger: ILogger;
  metadata: Metadata;
  request: Request;
  session: PylonSession | null;
  tokens: Dict<VerifiedJwt | VerifiedJws<any>>;
  userAgent: UserAgent;
  webhook: Webhook<WebhookData>;

  setCookie<T = any>(name: string, value: T, options?: SetCookieOptions): Promise<void>;
  getCookie<T = any>(name: string, options?: GetCookieOptions): Promise<T | undefined>;
  delCookie(name: string): void;
};

export type PylonHttpContext<Data = any, WebhookData = any> = RouterContext &
  UserAgentContext &
  Context<Data, WebhookData>;

export type PylonHttpMiddleware<C extends PylonHttpContext = PylonHttpContext> =
  Middleware<DefaultState, C>;
