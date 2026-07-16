import type { PylonSignKey, PylonVerifyKey } from "../../../types/index.js";

/**
 * The verification policy for one cookie scope, DERIVED from its signature.
 *
 * Verification asks: *is the key that signed this cookie one of the keys I would
 * have signed it with?* That question IS the signing policy — so the signing
 * selector's `predicate` becomes the verification predicate. There is no
 * `verification` selector to declare: naming the `signature` is naming the read
 * policy too.
 *
 * A signature short-circuits BEFORE the fallback is consulted, so a scope that
 * signs with its own key owns its read policy too — even when that signature is
 * an injected `kryptos` with no predicate to inherit. That case yields
 * `{ predicate: undefined }` (the floor `use: "sig"` alone), NOT `undefined`:
 * the result is consumed as `<scope policy> ?? <deployment default>`, so an
 * absent policy would fall through to the fallback's predicate — which the
 * injected key, chosen outside it, would fail. The floor alone is a POLICY, not
 * the lack of one.
 *
 * No signature named anywhere ⇒ `undefined` ⇒ verification is off.
 */
export const resolveVerificationKey = (
  signature?: PylonSignKey,
  fallback?: PylonSignKey,
): PylonVerifyKey | undefined => {
  const resolved = signature ?? fallback;

  return resolved ? { predicate: resolved.predicate } : undefined;
};
