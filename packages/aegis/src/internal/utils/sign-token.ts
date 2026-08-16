import type { RawSignInput, SignedToken } from "../../types/index.js";
import { assertWireInput } from "../wire/assert-wire-input.js";
import type { SignOpaqueInput } from "../wire/token-wire.js";
import { tokenWireFor } from "../wire/token-wire-for.js";
import type { AegisDeps } from "./aegis-deps.js";
import { domainHeaderToWire } from "./domain-header-to-wire.js";
import { domainTokenTypePrefix } from "./compute-typ-header.js";
import { SIGN_OPAQUE_FORMAT } from "./sign-opaque-format.js";

/**
 * THE raw sign pipeline (`aegis.sign`) — a signature over caller content, with no
 * PROFILE. It is the SERIALISATION that is opaque here, not the payload's status:
 * the JWS/CWS structures carry no claims layer of their own, so a `string` or a
 * `Buffer` rides through as bytes and comes back as bytes.
 *
 * ⚠ A `Dict` handed to this door IS A CLAIMS SET, and is normalised as one —
 * `jose-token-wire.ts:260` and `raw-sign-cose.ts:63` both apply the same
 * `normaliseClaims` every other signing door applies. That is a statement about
 * THE DOOR, not about the payload's JS type: `sign` attributes content to an
 * author, and what an author asserts is a claims set whichever structure carries
 * it. `encrypt` is the door that does NOT — it seals a value and hands that exact
 * value back, so its payload is the caller's secret rather than aegis's assertion
 * (`encrypt-token.ts`). The two doors differ on purpose; do not "restore the
 * symmetry" by making either one match the other.
 *
 * There is no format branch left: the wire is resolved ONCE, and the domain
 * `tokenType` → bare prefix and domain → wire header translations run above it,
 * exactly as they do for `mint`. The two wires now treat the payload the same
 * way — each hands its kit the caller's own value and lets the shared content
 * codec declare what it is — so a Dict comes back a Dict on either wire. The
 * JOSE side used to JSON-STRINGIFY an object first, which cost it the object on
 * the read and made the same domain call return two shapes.
 */
export const signToken = async ({
  input,
  deps,
}: {
  input: RawSignInput;
  deps: AegisDeps;
}): Promise<SignedToken> => {
  const format = SIGN_OPAQUE_FORMAT[input.format ?? "jws"];
  const wire = tokenWireFor(format);

  const signInput: SignOpaqueInput = {
    deps,
    payload: input.payload,
    key: input.key,
    tokenType: domainTokenTypePrefix(input.tokenType),
    header: domainHeaderToWire(input.header),
    bindCertificate: input.bindCertificate,
    certificateThumbprintSha1: input.certificateThumbprintSha1,
  };

  assertWireInput(wire.dispositions.signOpaque, signInput, {
    format,
    operation: "signOpaque",
  });

  return wire.signOpaque(signInput);
};
