import type { IKryptos } from "@lindorm/kryptos";
import { SignatureKit } from "../../classes/SignatureKit.js";
import { CwsError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import { assertProtectedHeaderGates } from "../utils/assert-protected-header-gates.js";
import { ERROR_BY_FORMAT, type SignedCoseFormat } from "./error-by-format.js";
import { requireAttachedPayload } from "./require-attached-payload.js";
import { requireSignature } from "./require-signature.js";
import { signedCoseStructureTag } from "./signed-cose-structure-tag.js";
import { splitSigned } from "./split-signed.js";
import { COSE_TAG, buildSecuredStructure } from "./structures.js";

/** What a verified signed COSE structure yields to the path that opened it. */
export type VerifiedCoseStructure = {
  /** The PROTECTED bucket, JOSE-named — the one the signature/MAC covers. */
  protectedHeader: WireTokenHeader;
  /** The UNPROTECTED bucket, JOSE-named. Covered by nothing. */
  unprotectedHeader: WireTokenHeader;
  /** The authenticated payload bytes. What they MEAN is the caller's question. */
  content: Buffer;
};

/**
 * OPEN AND AUTHENTICATE a signed COSE token — the whole cycle every signed COSE
 * read runs, from the CBOR split to the verified payload bytes.
 *
 * In order: the structure the key implies is resolved, the token is split under
 * that tag alone (a COSE_Mac0 handed to an asymmetric key is refused as malformed
 * rather than carried into a signature cycle it could never satisfy), the two
 * PROTECTED-header gates answer a hostile header BEFORE any cryptography, the two
 * nil-able slots are refused with a structural verdict, and the signature or MAC
 * is checked over the structure.
 *
 * ⚠ It stops at the BYTES. `CwsKit.verify` reconstructs them by the protected
 * `cty`; `verifyCwt` reads them as an RFC 8392 CWT Claims Set. That trailing step
 * is the one honest difference between the two paths — opaque content versus a
 * claims Message — and it stays at the call site.
 *
 * ⚠ The tag is resolved HERE, from the key, rather than accepted as an argument.
 * A caller that could pass one could pass a tag that disagrees with the key it
 * also passed, which is a way for a read to open a structure the write never
 * produced; there is no such argument, so there is nothing to disagree about.
 */
export const verifyCoseStructure = ({
  kryptos,
  token,
  format,
  payloadDetail,
}: {
  kryptos: IKryptos;
  token: Buffer;
  /** Namespaces the header-gate refusals. The structural ones are shared. */
  format: SignedCoseFormat;
  /**
   * What a DETACHED payload means on this path, in the path's own words — "no
   * content to verify" for opaque bytes, "no CWT claims to verify" for a claims
   * token. The wording is not cosmetic: it is what tells a reader which door
   * refused them.
   */
  payloadDetail: string;
}): VerifiedCoseStructure => {
  const tag = signedCoseStructureTag(kryptos);
  const sign1 = tag === COSE_TAG.sign1;
  const label = sign1 ? "COSE_Sign1" : "COSE_Mac0";

  const { protectedBstr, payload, signature, protectedHeader, unprotectedHeader } =
    splitSigned(token, {
      arity: { exactly: 4 },
      tags: [tag],
      error: CwsError,
      message: `Malformed ${label}`,
      title: `Malformed ${label}`,
      details: `A ${label} must be a 4-element array [protected, unprotected, payload, signature/tag].`,
    });

  // ⛔ The two PROTECTED-header gates — `crit` (RFC 9052 §3.1), then the
  // algorithm-match — ahead of the signature cycle, so a hostile header is
  // answered before any cryptography is spent on it. The PROTECTED bucket alone:
  // the only one the signature covers, and the only one §3.1 permits `crit` in.
  //
  // ⚠ CRIT FIRST, and this is a CHANGED ORDER on the COSE wire. Both this path
  // and `CwsKit.verify` used to run the algorithm-match first, each behind a
  // comment claiming the pair matched `JwtKit`/`JwsKit` exactly — while the three
  // JOSE kits ran the opposite order. The two wires had drifted on which refusal
  // a doubly-hostile token gets, behind comments asserting they could not. There
  // is ONE pair now (`assertProtectedHeaderGates`), so there is nothing left to
  // drift; a token that is BOTH crit-hostile and alg-mismatched now reports the
  // crit verdict.
  //
  // ⚠ The ORDER is aegis policy, NOT a specification requirement. RFC 9052 §3.1
  // does not even make an unrecognised crit member fatal: it says the parameter
  // indicates what a processor is "required to understand", and its one
  // fatal-error clause is about a label MISSING FROM the protected bucket, which
  // is a different condition (`reject-unknown-critical.ts` cites it correctly,
  // for its MALFORMED branch). The refusal here is aegis deriving the
  // consequence, and the precedence over `alg` is ours outright. Reasons stated
  // once, on `assertProtectedHeaderGates`; do not restate them here as spec.
  assertProtectedHeaderGates({
    protectedHeader,
    expectedAlgorithm: kryptos.algorithm,
    format,
    error: ERROR_BY_FORMAT[format],
    algDetails:
      "The protected header alg does not match the algorithm of the configured kryptos key.",
  });

  // A DETACHED (nil) payload is legal COSE, but no aegis read path carries
  // out-of-band content, so there is nothing to authenticate — refused with the
  // structural `cose_malformed` verdict rather than a raw `Buffer.from(null)`
  // TypeError, which would escape the `AegisError` contract entirely.
  const content = requireAttachedPayload(payload, {
    error: CwsError,
    message: `Malformed ${label}`,
    title: `Malformed ${label}`,
    details: `The ${label} has a detached or nil payload, so ${payloadDetail}.`,
  });

  // The twin of the payload check on the other nil-able slot: `exactly: 4` counts
  // ELEMENTS, so a structure with `null` in slot 4 clears the arity, algorithm and
  // crit gates intact. Refused with the same structural verdict rather than
  // letting `Buffer.from(null)` throw a raw TypeError out of the error contract.
  const secured = requireSignature(signature, {
    error: CwsError,
    message: `Malformed ${label}`,
    title: `Malformed ${label}`,
    details: `The ${label} has a nil ${sign1 ? "signature" : "authentication tag"}, so there is nothing to verify.`,
  });

  const valid = new SignatureKit({ kryptos, raw: sign1 }).verify(
    buildSecuredStructure(tag, Buffer.from(protectedBstr), content),
    secured,
  );

  if (!valid) {
    throw sign1
      ? new CwsError("Invalid COSE_Sign1 signature", {
          code: "cose_signature_invalid",
          title: "Invalid COSE Signature",
          details: "The COSE_Sign1 signature did not verify against the resolved key.",
        })
      : new CwsError("Invalid COSE_Mac0 tag", {
          code: "cose_mac_invalid",
          title: "Invalid COSE MAC",
          details:
            "The COSE_Mac0 authentication tag did not verify against the resolved key.",
        });
  }

  return { protectedHeader, unprotectedHeader, content };
};
