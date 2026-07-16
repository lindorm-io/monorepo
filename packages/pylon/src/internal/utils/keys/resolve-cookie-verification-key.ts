import { applyKeyFloor, VERIFY_FLOOR, type IAmphora } from "@lindorm/amphora";
import { ClientError } from "@lindorm/errors";
import type { IKryptos } from "@lindorm/kryptos";
import { Predicated } from "@lindorm/utils";
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
  // key the cookie names, and a duck-typed `key.predicate` must never override
  // the deployment policy. Per-layer `undefined` stripping keeps a
  // `{ x: undefined }` predicate from erasing a constraint.
  const floor = applyKeyFloor(VERIFY_FLOOR, key?.predicate);

  if (!Predicated.match(kryptos, floor)) {
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
