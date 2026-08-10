import type { VerifiedToken } from "@lindorm/aegis";
import type { Dict } from "@lindorm/types";
import type { IPylonSession } from "../../interfaces/index.js";
import type { AppState } from "../context/context-common.js";
import type { PylonClientContext } from "../context/pylon-client-context.js";
import type { PylonResolvedAccess } from "../context/pylon-resolved-access.js";
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
  /**
   * The credential the handshake resolved, republished on every event by the
   * fast path. It sits BESIDE `tokens.bearer` rather than being derived from it
   * because an OPAQUE credential produces no `VerifiedToken` at all — reading
   * the access state off `tokens.bearer` is exactly what made an opaque token
   * unable to authenticate over a socket.
   */
  access?: PylonResolvedAccess;
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
