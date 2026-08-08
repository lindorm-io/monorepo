import type { Middleware } from "@lindorm/middleware";
import type { Dict } from "@lindorm/types";
import type { Files } from "formidable";
import type { BaseRequest } from "koa";
import type { RouterContext } from "koa-router";
import type {
  IPylonCookies,
  IPylonFileUpload,
  IPylonSession,
} from "../../interfaces/index.js";
import type { PylonChallenge } from "../http/challenge.js";
import type {
  PylonCommonContext,
  PylonHttpMetadata,
  PylonState,
} from "./context-common.js";
import type { PylonAuthClient } from "../http/pylon-auth-client.js";
import type { PylonRoomContextHttp } from "./context-socket.js";
import type { PylonIoContextHttp } from "./pylon-io-context.js";
import type { PylonSessionOnContext } from "./session-context.js";
import type { PylonSocketEmitter } from "../socket/pylon-socket-emitter.js";

type KoaContext = Omit<RouterContext, "cookies" | "state" | "throw">;

type Request = BaseRequest & {
  body?: any;
  files?: Files;
  raw?: any;
};

export type PylonHttpState = PylonState & {
  metadata: PylonHttpMetadata;
  origin: string;
  session: IPylonSession | null;
  /**
   * Whether the refresh middleware exchanged this session's refresh token on
   * THIS request — a per-request runtime FACT, which is why it sits here and not
   * on `state.app.config`, the deployment's resolved policy.
   *
   * The middleware records what it DID; it never learns why it ran. `/refresh`
   * synthesises `mode: "force"`, but `force` is also a legitimate configured mode
   * on `/introspect` and `/userinfo`, so the mode cannot tell an explicit refresh
   * from an opportunistic one — and does not have to. Every mount records
   * alike, and the route that cares reports it.
   *
   * `false` covers every non-refresh outcome: the mode said not yet, the driver
   * has no refresh grant, the session held no refresh token, or the grant failed
   * (in which case `session` is `null` — the session is gone, not stale).
   */
  sessionRefreshed: boolean;
};

type Context<Data, State> = {
  auth: PylonAuthClient;
  challenge: PylonChallenge;
  cookies: IPylonCookies;
  data: Data;
  io: PylonIoContextHttp;
  // koa-router populates `params` at runtime; declare it explicitly so the type
  // does not depend on koa-router's RouterContext surviving `Omit`/koa's
  // ParameterizedContext plumbing. Required for assignability to PylonContext
  // (so `useSchema` + `useHandler` can share a single route middleware array).
  params: Dict<string>;
  request: Request;
  session: PylonSessionOnContext;
  signal: AbortSignal;
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
