import type { Middleware } from "@lindorm/middleware";
import type { Files } from "formidable";
import type { BaseRequest } from "koa";
import type { RouterContext } from "koa-router";
import type {
  IPylonCookies,
  IPylonFileUpload,
  IPylonSession,
} from "../interfaces/index.js";
import type {
  PylonCommonContext,
  PylonHttpMetadata,
  PylonState,
} from "./context-common.js";
import type { PylonAuthClient } from "./pylon-auth-client.js";
import type { PylonRoomContextHttp } from "./context-socket.js";
import type { PylonIoContextHttp } from "./pylon-io-context.js";
import type { PylonSessionOnContext } from "./session.js";
import type { PylonSocketEmitter } from "./pylon-socket-emitter.js";

type KoaContext = Omit<RouterContext, "cookies" | "state">;

type Request = BaseRequest & {
  body?: any;
  files?: Files;
  raw?: any;
};

export type PylonHttpState = PylonState & {
  metadata: PylonHttpMetadata;
  origin: string;
  session: IPylonSession | null;
};

type Context<Data, State> = {
  auth: PylonAuthClient;
  cookies: IPylonCookies;
  data: Data;
  io: PylonIoContextHttp;
  request: Request;
  session: PylonSessionOnContext;
  state: State;
  rooms?: PylonRoomContextHttp;
  socket?: PylonSocketEmitter;

  files: Array<IPylonFileUpload>;
};

export type PylonHttpContext<
  Data = any,
  State extends PylonHttpState = PylonHttpState,
> = KoaContext & PylonCommonContext & Context<Data, State>;

export type PylonHttpMiddleware<C extends PylonHttpContext = PylonHttpContext> =
  Middleware<C>;
