import { ParsedJws, ParsedJwt } from "@lindorm/aegis";
import { Dict } from "@lindorm/types";
import { AppState } from "./context-common";
import { IoSocket } from "./socket";

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
  pylon: PylonSocketPylonNamespace;
};

export type PylonSocket<D extends PylonSocketData = PylonSocketData> = IoSocket<D>;
