import { omitUndefined } from "@lindorm/utils";
import { resolveVerificationKey } from "./resolve-verification-key.js";
import type { PylonKeySelectors, PylonResolvedKeys } from "./types.js";

/**
 * The session cookie's resolved keys.
 *
 * A pylon session IS a cookie — with a kv store the cookie carries `{ id, sec }`
 * and the tokens are sealed at rest under a key derived from that `sec`, without
 * one the whole session travels IN the cookie — so the session's keys DEFAULT to
 * the cookie's, and a deployment names
 * `session.signature`/`session.encryption` only when it wants a different key (a
 * different blast radius, or an asymmetric signature for session cookies
 * specifically).
 *
 * `signature` chains plainly: `session.signature ?? cookies.signature`. No merging
 * of conditions, no partial inheritance — the role is either the deployment's
 * session choice or its cookie choice, never a blend of the two.
 *
 * `verification` does NOT chain plainly, because it is not independent of
 * `signature`: it is the CHECK on the key a signature produced. It resolves
 * through `resolveVerificationKey` from the SAME resolved signature — so naming
 * `session.signature` alone is sufficient and cannot leave the session cookie
 * unreadable.
 *
 * ⚠ `encryption` does NOT chain at all — it is REQUIRED on `PylonSessionSettings`
 * and read straight off it. Sessions used to inherit `cookies.encryption`, which
 * meant the type could not demand a key (it might arrive from the sibling object)
 * and a boot check had to report the missing one instead. Requiring it here makes
 * the unsealed session unrepresentable rather than merely rejected, and the check
 * is gone. `signature` keeps inheriting because an absent signature is a real
 * choice — signing off — while an absent encryption never was.
 */
export const resolveSessionKeys = (
  session?: PylonKeySelectors,
  cookie?: PylonKeySelectors,
): PylonResolvedKeys =>
  omitUndefined<PylonResolvedKeys>({
    signature: session?.signature ?? cookie?.signature,
    verification: resolveVerificationKey(session?.signature, cookie?.signature),
    encryption: session?.encryption,
  });
