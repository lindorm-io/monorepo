import { removeUndefined } from "@lindorm/utils";
import type { PylonKeyRoles, PylonKeys } from "../../../types/index.js";
import { resolveVerificationKey } from "./resolve-verification-key.js";

/**
 * The session cookie's keys.
 *
 * A pylon session IS a cookie — with a kv store the cookie carries the id and
 * the tokens are sealed at rest, without one the whole session travels IN the
 * cookie — so the session's keys DEFAULT to the cookie's, and a deployment names
 * `session` only when it wants a different key (a different blast radius, or an
 * asymmetric signature for session cookies specifically).
 *
 * `signature` and `encryption` chain plainly: `session.<role> ?? cookie.<role>`.
 * No merging of predicates, no partial inheritance — a role is either the
 * deployment's session choice or its cookie choice, never a blend of the two.
 *
 * `verification` does NOT chain plainly, because it is not independent of
 * `signature`: it is the CHECK on the key a signature produced. It resolves
 * through `resolveVerificationKey`, which reads a scope's signing predicate as
 * its verification policy — so naming `session.signature` alone is sufficient
 * and cannot leave the session cookie unreadable.
 */
export const resolveSessionKeys = (keys?: PylonKeys): PylonKeyRoles =>
  removeUndefined<PylonKeyRoles>({
    signature: keys?.session?.signature ?? keys?.cookie?.signature,
    verification: resolveVerificationKey(keys?.session, keys?.cookie),
    encryption: keys?.session?.encryption ?? keys?.cookie?.encryption,
  });
