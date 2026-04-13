import { Middleware } from "@lindorm/middleware";
import { Files } from "formidable";
import { BaseRequest } from "koa";
import { RouterContext } from "koa-router";
import { IPylonCookies, IPylonFileUpload, IPylonSession } from "../interfaces";
import { PylonCommonContext, PylonHttpMetadata, PylonState } from "./context-common";
import { PylonAuthClient } from "./pylon-auth-client";
import { PylonRoomContextHttp } from "./context-socket";
import { PylonIoContextHttp } from "./pylon-io-context";
import { PylonSessionOnContext } from "./session";
import { PylonSocketEmitter } from "./pylon-socket-emitter";

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
