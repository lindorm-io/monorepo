import { ClientError } from "@lindorm/errors";
import type {
  PylonResolvedAccess,
  PylonSocketAuthStrategy,
  PylonSocketContext,
} from "../../../types/index.js";
import { DEFAULT_AUTH_WARNING_MS } from "../../constants/auth.js";
import { isInExpiryWarningWindow } from "../auth-state/is-in-expiry-warning-window.js";
import { isTokenExpired } from "../auth-state/is-token-expired.js";
import { markAuthExpiredEmitted } from "../auth-state/mark-auth-expired-emitted.js";
import { shouldEmitAuthExpired } from "../auth-state/should-emit-auth-expired.js";

/**
 * What the caller needs to log about an accepted fast path — returned rather
 * than logged here so the socket arm shares the ONE timer the middleware
 * started, exactly as the http arm does.
 */
export type SocketFastPath = {
  expiresAt: Date;
  strategy: PylonSocketAuthStrategy;
};

export const runSocketAccessToken = (ctx: PylonSocketContext): SocketFastPath => {
  const auth = ctx.io.socket.data?.pylon?.auth;

  if (!auth) {
    throw new ClientError("Invalid credentials", {
      details:
        "No handshake auth state — install useAccessToken in socket.connectionMiddleware",
      status: ClientError.Status.Unauthorized,
      code: "missing_handshake_auth_state",
      type: "urn:lindorm:pylon:error:missing_handshake_auth_state",
      title: "Missing Handshake Auth State",
    });
  }

  const expiresAt = auth.getExpiresAt();
  const now = new Date();

  if (isTokenExpired(expiresAt, now)) {
    throw new ClientError("Access token expired", {
      status: ClientError.Status.Unauthorized,
      code: "access_token_expired",
      type: "urn:lindorm:pylon:error:access_token_expired",
      title: "Access Token Expired",
      data: { expiresAt: expiresAt.toISOString() },
      debug: { strategy: auth.strategy },
    });
  }

  if (
    isInExpiryWarningWindow(expiresAt, now, DEFAULT_AUTH_WARNING_MS) &&
    shouldEmitAuthExpired(auth, now)
  ) {
    ctx.io.socket.emit("$pylon/auth/expired", { expiresAt });
    markAuthExpiredEmitted(auth, now);
  }

  const bearer = ctx.io.socket.data.tokens.bearer;
  ctx.state.tokens.accessToken = bearer;
  // Verified at handshake by the same middleware mounted in
  // `socket.connectionMiddleware`; the fast path re-checks expiry, not the
  // signature — provenance is still local.
  ctx.state.access = {
    provenance: "verified",
    claims: bearer.claims,
    token: bearer.token,
  } satisfies PylonResolvedAccess;

  return { expiresAt, strategy: auth.strategy };
};
