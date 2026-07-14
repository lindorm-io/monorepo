import type {
  PylonKeyRoles,
  PylonSignKey,
  PylonVerifyKey,
} from "../../../types/index.js";

/**
 * A signature's predicate, read as a verification policy.
 *
 * An injected `kryptos` has no predicate to inherit, and we do NOT synthesise one
 * from the key's attributes — the cookie's `.kid` names the key and the floor
 * (`use: "sig"`) still applies. That case yields `{ predicate: undefined }`, i.e.
 * "the floor alone", and NOT `undefined`: the result is consumed as
 * `cookie.verification ?? <deployment default>`, so an absent policy would fall
 * through to the deployment's predicate — which the injected key, by definition
 * chosen outside it, would fail. The floor alone is a POLICY, not the lack of one.
 */
const inherited = (signature: PylonSignKey): PylonVerifyKey => ({
  predicate: signature.predicate,
});

/**
 * The verification policy for one cookie scope.
 *
 * Verification asks: *is the key that signed this cookie one of the keys I would
 * have signed it with?* That question IS the signing policy — so when a scope
 * names a `signature` but no `verification`, the signing predicate becomes the
 * verification predicate.
 *
 * This is not a convenience. Defaulting to anything else — least of all another
 * scope's predicate — can only ever reject a cookie we ourselves just issued:
 * name `session.signature` alone, let the check fall through to
 * `cookie.verification`, and every session cookie fails on the next read. The
 * two roles are not independent, so the fallback is not per-role here.
 *
 * Hence the order, and hence `scope.signature` short-circuits BEFORE the
 * fallback scope is consulted: a scope that signs with its own key owns its read
 * policy too, even when that signature is an injected `kryptos` with no
 * predicate to inherit (floor alone — never the fallback's predicate, which the
 * injected key would fail).
 *
 * An explicit `verification` always wins, for the deployment that wants a
 * genuinely BROADER read policy than its write policy — accepting a key rotated
 * out of the current signing predicate, say.
 */
export const resolveVerificationKey = (
  scope: PylonKeyRoles | undefined,
  fallback?: PylonKeyRoles,
): PylonVerifyKey | undefined => {
  if (scope?.verification) return scope.verification;
  if (scope?.signature) return inherited(scope.signature);
  if (fallback?.verification) return fallback.verification;
  if (fallback?.signature) return inherited(fallback.signature);

  return undefined;
};
