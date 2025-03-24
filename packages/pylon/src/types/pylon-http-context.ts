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
import { PylonCookieKit } from "../classes/private/PylonCookieKit";
import { PylonSession } from "./session";
import { IoServer } from "./socket";

type KoaContext = Omit<RouterContext, "cookies">;

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
  cookies: PylonCookieKit;
  data: Data;
  io: IoServer;
  logger: ILogger;
  metadata: Metadata;
  request: Request;
  session: PylonSession | null;
  sessions: {
    set(session: PylonSession): Promise<void>;
    get(): Promise<PylonSession | null>;
    del(): Promise<void>;
  };
  tokens: Dict<VerifiedJwt | VerifiedJws<any>>;
  webhook: Webhook<WebhookData>;
};

export type PylonHttpContext<Data = any, WebhookData = any> = KoaContext &
  Context<Data, WebhookData>;

export type PylonHttpMiddleware<C extends PylonHttpContext = PylonHttpContext> =
  Middleware<C>;
