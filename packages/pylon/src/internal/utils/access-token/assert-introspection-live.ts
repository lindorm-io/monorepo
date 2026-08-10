import { Aegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import type { Dict } from "@lindorm/types";
import type { PylonIntrospectionActive } from "../../../types/index.js";

/**
 * The TEMPORAL check the INTROSPECTED arm owns — the counterpart of the range
 * check aegis runs inside the structured verify.
 *
 * RFC 7662 `active` is primary and is consumed before this runs. What it does
 * NOT cover is an answer that reports a stale `exp` while still saying
 * `active: true` — the authorization server contradicting itself.
 *
 * ⚠ The window is `Aegis.matches`'s DEFAULT one — the same builder
 * `aegis.verify` runs, with the same clock tolerance — not a hand-rolled
 * `exp > now`. A hand-rolled comparison carries no tolerance, so it rejected
 * claims the structured arm accepts inside its skew window: two answers to one
 * question. The duplication with the shared assert that follows is deliberate
 * and kept: this rejects a self-contradicting answer at the arm that produced
 * it, naming introspection as the reason.
 *
 * The answer's `token_type` is the OTHER thing this arm owns, and it is
 * `assertIntrospectionScheme`'s — a scheme comparison, not a temporal one.
 */
export const assertIntrospectionLive = (
  introspection: PylonIntrospectionActive,
): void => {
  const live = Aegis.matches(introspection as Dict, {});

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
