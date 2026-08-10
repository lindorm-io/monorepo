import { Aegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import type { Dict } from "@lindorm/types";
import type { PylonIntrospectionActive } from "../../../types/index.js";

/**
 * The temporal check the INTROSPECTED arm owns, and only it.
 *
 * RFC 7662 `active` is primary and is consumed before this runs; this catches
 * the answer that reports a stale `exp` while still saying `active: true` — the
 * authorization server contradicting itself, which no `active` check can see.
 *
 * ⚠ Deliberately NOT shared with the structured arm. Aegis range-checks `exp`/
 * `nbf`/`iat` inside verify WITH the instance's clock tolerance; a naive
 * `exp > now` applied on top would REJECT tokens the profiled verify accepts
 * inside its tolerance window, so each arm owns its own temporal reasoning.
 * There is no tolerance to apply here: an introspection answer is fetched live
 * from the authority, not carried across a clock boundary.
 */
export const assertIntrospectionLive = (
  introspection: PylonIntrospectionActive,
  now: Date,
): void => {
  const live = Aegis.matches(introspection as Dict, {
    expiresAt: { $or: [{ $exists: false }, { $gt: now }] },
    notBefore: { $or: [{ $exists: false }, { $lte: now }] },
  });

  if (live === true) return;

  throw new ClientError("Access token is not active", {
    status: ClientError.Status.Unauthorized,
    code: "token_not_active",
    type: "urn:lindorm:pylon:error:token_not_active",
    title: "Token Not Active",
    details:
      "Token introspection answered active: true for a token its own claims place outside its validity window",
    data: {
      expiresAt: introspection.expiresAt?.toISOString(),
      notBefore: introspection.notBefore?.toISOString(),
    },
  });
};
