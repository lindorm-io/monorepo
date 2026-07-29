import { omitUndefined } from "@lindorm/utils";
import { resolveVerificationKey } from "./resolve-verification-key.js";
import type { PylonKeySelectors, PylonResolvedKeys } from "./types.js";

/**
 * The session cookie's resolved keys.
 *
 * A pylon session IS a cookie — with a kv store the cookie carries the id and
 * the tokens are sealed at rest, without one the whole session travels IN the
 * cookie — so the session's keys DEFAULT to the cookie's, and a deployment names
 * `session.signature`/`session.encryption` only when it wants a different key (a
 * different blast radius, or an asymmetric signature for session cookies
 * specifically).
 *
 * `signature` and `encryption` chain plainly: `session.<role> ?? cookies.<role>`.
 * No merging of conditions, no partial inheritance — a role is either the
 * deployment's session choice or its cookie choice, never a blend of the two.
 *
 * `verification` does NOT chain plainly, because it is not independent of
 * `signature`: it is the CHECK on the key a signature produced. It resolves
 * through `resolveVerificationKey` from the SAME resolved signature — so naming
 * `session.signature` alone is sufficient and cannot leave the session cookie
 * unreadable.
 */
export const resolveSessionKeys = (
  session?: PylonKeySelectors,
  cookie?: PylonKeySelectors,
): PylonResolvedKeys =>
  omitUndefined<PylonResolvedKeys>({
    signature: session?.signature ?? cookie?.signature,
    verification: resolveVerificationKey(session?.signature, cookie?.signature),
    encryption: session?.encryption ?? cookie?.encryption,
  });
