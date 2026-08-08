import { Matcher } from "@lindorm/match";
import { applyKeyFloor, VERIFY_FLOOR, type IAmphora } from "@lindorm/amphora";
import { ClientError } from "@lindorm/errors";
import type { IKryptos } from "@lindorm/kryptos";
import type { PylonVerifyKey } from "../../../types/index.js";

/**
 * Resolve the key a cookie's `.kid` names, then CHECK it.
 *
 * Selection is driven by the cookie itself, so the deployment's policy cannot be
 * a query here — it has to be a check on the resolved key to bite at all. That
 * closes the cross-role hole: without it, a client that names any kid in the
 * vault picks the class of key its cookie is verified against, and a cookie
 * signed by the published token key would verify like any other.
 *
 * `findByIdSync` is deliberately UNFILTERED: a cookie signed by a key that has
 * since rotated out of the active set must still verify. That is what the floor's
 * `isPending: false` — rather than `isActive` — preserves: an EXPIRED key keeps
 * verifying (or a rotation would log out every live session), while a key whose
 * `notBefore` has not passed, and which therefore cannot have signed anything, is
 * refused.
 *
 * ⚠ NO `UNPUBLISHED_DEFAULT` here, unlike the sign and seal resolvers. Theirs is
 * a vault QUERY, where the default reaches past amphora's publish gate to their
 * own key; this is a CHECK on a key `findByIdSync` already returned, and that
 * call is unfiltered — there is no gate, so a `publish` layer would stop meaning
 * "where to look" and start asserting that the key is unpublished. That is a
 * policy the deployment did not state, and it would break the round trip it is
 * supposed to protect: a `signature` given as an injected `kryptos` has no
 * condition to inherit, so the check would be floor plus default alone and would
 * refuse a published key pylon had just signed with.
 *
 * Every failure is the client's: it presented the `.kid`. The caller wraps a
 * throw as an invalid cookie signature.
 */
export const resolveCookieVerificationKey = (
  amphora: IAmphora,
  kid: string,
  key: PylonVerifyKey | undefined,
  name: string,
): IKryptos => {
  const kryptos = amphora.findByIdSync(kid);

  // The floor is applied LAST so it always wins: this floor is the CHECK on the
  // key the cookie names, and a duck-typed `key.condition` must never override
  // the deployment policy. Per-layer `undefined` stripping keeps a
  // `{ x: undefined }` condition from erasing a constraint.
  const floor = applyKeyFloor(VERIFY_FLOOR, key?.condition);

  if (!Matcher.match(kryptos, floor)) {
    throw new ClientError("Cookie key violates the verification floor", {
      code: "invalid_cookie_key",
      title: "Invalid Cookie Key",
      type: "urn:lindorm:pylon:error:invalid_cookie_key",
      details:
        "The key the cookie names cannot verify it: it is not a signing key, it is not yet valid, or it is not the key this deployment signs cookies with.",
      status: ClientError.Status.Unauthorized,
      data: { name, kid },
      debug: { floor, kryptos: kryptos.toJSON() },
    });
  }

  return kryptos;
};
