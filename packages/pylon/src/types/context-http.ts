import { ParsedCws, ParsedCwt, ParsedJws, ParsedJwt } from "@lindorm/aegis";
import { Middleware } from "@lindorm/middleware";
import { Dict, Environment } from "@lindorm/types";
import { Files } from "formidable";
import { BaseRequest } from "koa";
import { RouterContext } from "koa-router";
import { IPylonCookies, IPylonFileUpload, IPylonSession } from "../interfaces";
import { AuthorizationState } from "./authorization";
import { AppState, PylonCommonContext } from "./context-common";
import { PylonSessionOnContext } from "./session";
import { IoServer } from "./socket";

type KoaContext = Omit<RouterContext, "cookies" | "state">;

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

export type PylonHttpState = {
  app: AppState;
  authorization: AuthorizationState;
  metadata: MetadataState;
  session: IPylonSession | null;
  tokens: Dict<ParsedJwt | ParsedJws<any> | ParsedCwt | ParsedCws<any>>;
};

type Context<Data, State> = {
  cookies: IPylonCookies;
  data: Data;
  io: IoServer;
  request: Request;
  session: PylonSessionOnContext;
  state: State;

  files: Array<IPylonFileUpload>;
};

export type PylonHttpContext<
  Data = any,
  State extends PylonHttpState = PylonHttpState,
> = KoaContext & PylonCommonContext & Context<Data, State>;

export type PylonHttpMiddleware<C extends PylonHttpContext = PylonHttpContext> =
  Middleware<C>;
