import { Aegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { PylonIntrospectionActive } from "../../../types/index.js";

/**
 * The checks the INTROSPECTED arm owns, and only it — everything the structured
 * arm gets from the `access_token` profile floor and has no counterpart here.
 *
 * RFC 7662 `active` is primary and is consumed before this runs. What it does
 * NOT cover is an answer that reports a stale `exp` while still saying
 * `active: true` (the authorization server contradicting itself), or one that
 * simply declines to say what it answered about.
 *
 * ⚠ The temporal window is `Aegis.matches`'s DEFAULT one — the same builder
 * `aegis.verify` runs, with the same clock tolerance — not a hand-rolled
 * `exp > now`. A hand-rolled comparison carries no tolerance, so it rejected
 * claims the structured arm accepts inside its skew window: two answers to one
 * question. The duplication with the shared assert that follows is deliberate
 * and kept: this rejects a self-contradicting answer at the arm that produced
 * it, naming introspection as the reason.
 *
 * ⚠ `tokenType` is asserted PRESENT, not equal. RFC 7662 §2.2's `token_type` is
 * RFC 6749 §7.1's presentation scheme (`Bearer`/`DPoP`) — a homonym of the JOSE
 * `typ` the profile floor matches, so there is no value to compare it against.
 * Its ABSENCE is the thing that matters: the structured arm can never produce a
 * credential whose type went unstated, and an answer of bare `{ active: true }`
 * must not be the one shape that slips past.
 */
export const assertIntrospectionLive = (
  introspection: PylonIntrospectionActive,
): void => {
  if (!isString(introspection.tokenType) || introspection.tokenType.length === 0) {
    throw new ClientError("Access token type is unstated", {
      status: ClientError.Status.Unauthorized,
      code: "introspection_token_type_missing",
      type: "urn:lindorm:pylon:error:introspection_token_type_missing",
      title: "Introspection Token Type Missing",
      details:
        "Token introspection answered active: true without a token_type (RFC 7662 §2.2). A locally verified credential always declares its type in the header typ, so an introspected one must declare it too.",
    });
  }

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
