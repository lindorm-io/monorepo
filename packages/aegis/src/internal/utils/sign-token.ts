import type { RawSignInput, SignedToken } from "../../types/index.js";
import { assertWireInput } from "../wire/assert-wire-input.js";
import type { SignClaimsInput } from "../wire/token-wire.js";
import { tokenWireFor } from "../wire/token-wire-for.js";
import type { AegisDeps } from "./aegis-deps.js";
import { domainHeaderToWire } from "./domain-header-to-wire.js";
import { signTypPrefix } from "./sign-typ-prefix.js";

/**
 * THE `aegis.sign` pipeline — the DOMAIN sign verb, profile-less, CLAIMS ONLY.
 *
 * There is no router and no format branch: every format this verb accepts is a
 * claims format, so the payload is a domain claim set unconditionally and
 * `tokenWireFor` is the only dispatch left. `format` defaults to `"jwt"`, the
 * same default `mint` applies.
 *
 * It reaches the SAME seam `mint` reaches (`wire.signClaims`, behind the same
 * `assertWireInput` guard), so the domain → wire claim translation, the header
 * translation and the kit option forwarding are one implementation for both
 * verbs. Every non-floor knob `mint` forwards is forwarded here too; see
 * {@link RawSignInput} for what is deliberately not.
 */
export const signToken = async ({
  input,
  deps,
}: {
  input: RawSignInput;
  deps: AegisDeps;
}): Promise<SignedToken> => {
  const format = input.format ?? "jwt";
  const wire = tokenWireFor(format);

  // No profile, so no algorithm-class floor — `resolveSignKey` applies whichever
  // floor the profile carries and there is none to carry.
  const kryptos = await deps.resolveSignKey({ key: input.key });

  const signInput: SignClaimsInput = {
    kryptos,
    deps,
    common: input.payload,
    format,
    tokenType: signTypPrefix({ typ: input.typ, tokenType: input.tokenType }),
    header: domainHeaderToWire(input.header),
    proprietary: input.proprietary,
    bindCertificate: input.bindCertificate,
  };

  assertWireInput(wire.dispositions.signClaims, signInput, {
    format,
    operation: "signClaims",
  });

  return wire.signClaims(signInput);
};
