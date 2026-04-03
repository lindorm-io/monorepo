import { Middleware } from "@lindorm/middleware";
import { Files } from "formidable";
import { BaseRequest } from "koa";
import { RouterContext } from "koa-router";
import { IPylonCookies, IPylonFileUpload, IPylonSession } from "../interfaces";
import { PylonCommonContext, PylonHttpMetadata, PylonState } from "./context-common";
import { PylonSessionOnContext } from "./session";
import { IoServer } from "./socket";

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
