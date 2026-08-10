import type { VerifiedToken } from "@lindorm/aegis";
import type { PylonResolvedAccess } from "../../../types/index.js";

/**
 * The resolved access a COOKIE SESSION establishes. One definition, because four
 * places produce it — the HTTP session arm, the handshake session arm, the
 * connection session middleware, and the session refresh handler — and a socket
 * that got its access shape from only three of them serves the wrong claims (or
 * none) on the fourth.
 *
 * `token` is the SESSION's stored access token, not the parsed artifact's own
 * `token` field: they are the same string today, and stating which one is meant
 * keeps them from drifting apart silently.
 */
export const sessionResolvedAccess = (
  accessToken: string,
  parsed: VerifiedToken,
): PylonResolvedAccess => ({
  provenance: "verified",
  claims: parsed.claims,
  custom: parsed.custom,
  token: accessToken,
});
