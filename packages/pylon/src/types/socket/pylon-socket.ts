import type { VerifiedToken } from "@lindorm/aegis";
import type { Dict } from "@lindorm/types";
import type { IPylonSession } from "../../interfaces/index.js";
import type { AppState } from "../context/context-common.js";
import type { PylonClientContext } from "../context/pylon-client-context.js";
import type { IoSocket } from "./io.js";

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
  client?: PylonClientContext;
  tokens: Dict<VerifiedToken>;
  session?: IPylonSession | null;
  pylon: PylonSocketPylonNamespace;
};

export type PylonSocket<D extends PylonSocketData = PylonSocketData> = IoSocket<D>;
