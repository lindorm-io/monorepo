import type { ParsedJws, ParsedJwt } from "@lindorm/aegis";
import type { Dict } from "@lindorm/types";
import type { IPylonSession } from "../interfaces/index.js";
import type { AppState } from "./context-common.js";
import type { IoSocket } from "./socket.js";

export type PylonListenerMethod =
  | "on"
  | "onAny"
  | "onAnyOutgoing"
  | "once"
  | "prependAny"
  | "prependAnyOutgoing";

export type PylonSocketAuthStrategy = "bearer" | "dpop-bearer" | "session";

export type PylonSocketAuth = {
  strategy: PylonSocketAuthStrategy;
  getExpiresAt: () => Date;
  refresh: (payload: unknown) => Promise<void>;
  authExpiredEmittedAt: Date | null;
};

export type PylonSocketPylonNamespace = {
  auth?: PylonSocketAuth;
};

export type PylonSocketData = {
  app: AppState;
  tokens: Dict<ParsedJwt | ParsedJws<any>>;
  session?: IPylonSession | null;
  pylon: PylonSocketPylonNamespace;
};

export type PylonSocket<D extends PylonSocketData = PylonSocketData> = IoSocket<D>;
