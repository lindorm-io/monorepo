import type { RawSignInput, SignedToken } from "../../types/index.js";
import { assertWireInput } from "../wire/assert-wire-input.js";
import type { SignOpaqueInput } from "../wire/token-wire.js";
import { tokenWireFor } from "../wire/token-wire-for.js";
import type { AegisDeps } from "./aegis-deps.js";
import { domainHeaderToWire } from "./domain-header-to-wire.js";
import { domainTokenTypePrefix } from "./compute-typ-header.js";
import { SIGN_OPAQUE_FORMAT } from "./sign-opaque-format.js";

/**
 * THE raw sign pipeline (`aegis.sign`) — an OPAQUE signature over caller content,
 * with no claims layer and no profile.
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
