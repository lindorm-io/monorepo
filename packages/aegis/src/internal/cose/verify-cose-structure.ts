import type { IKryptos } from "@lindorm/kryptos";
import { SignatureKit } from "../../classes/SignatureKit.js";
import { CwsError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import type { CoseLabel } from "./cose-label.js";
import { assertProtectedHeaderGates } from "../utils/assert-protected-header-gates.js";
import { ERROR_BY_FORMAT, type SignedCoseFormat } from "./error-by-format.js";
import { requireAttachedPayload } from "./require-attached-payload.js";
import { requireSignature } from "./require-signature.js";
import { signedCoseStructureTag } from "./signed-cose-structure-tag.js";
import { splitSigned, type SignedSegments } from "./split-signed.js";
import { COSE_TAG, buildSecuredStructure } from "./structures.js";

/** What a verified signed COSE structure yields to the path that opened it. */
export type VerifiedCoseStructure = {
  /** The PROTECTED bucket, JOSE-named — the one the signature/MAC covers. */
  protectedHeader: WireTokenHeader;
  /** The UNPROTECTED bucket, JOSE-named. Covered by nothing. */
  unprotectedHeader: WireTokenHeader;
  /** Each bucket's params no registry row answers for — see `split-signed.ts`. */
  custom: SignedSegments["custom"];
  /**
   * The PROTECTED bucket as its RAW COSE label map — see `split-signed.ts`. The
   * translated header above is lossy by design, and this is what the certificate
   * binding reads for the digests JOSE has no parameter for.
   */
  protectedMap: Map<CoseLabel, unknown>;
  /** The authenticated payload bytes. What they MEAN is the caller's question. */
  content: Buffer;
};

/**
 * OPEN AND AUTHENTICATE a signed COSE token — the whole cycle every signed COSE
 * read runs, from the CBOR split to the verified payload bytes.
 *
 * ⚠ It stops at the BYTES. `CwsKit.verify` reconstructs them by the protected
 * `cty`; `verifyCwt` reads them as an RFC 8392 CWT Claims Set. That trailing step
 * is the one difference between the two paths and stays at the call site.
 *
 * ⚠ The tag is resolved HERE, from the key, and is not an argument: a caller able
 * to pass one could pass a tag that disagrees with the key it also passed, opening
 * a structure the write never produced.
 */
export const verifyCoseStructure = ({
  kryptos,
  token,
  declared,
  format,
  payloadDetail,
}: {
  kryptos: IKryptos;
  token: Buffer;
  /**
   * The custom critical parameters the CALLER takes responsibility for — its
   * `crit` verify option, handed to the crit gate below.
   */
  declared: ReadonlyArray<string> | undefined;
  /** Namespaces the header-gate refusals. The structural ones are shared. */
  format: SignedCoseFormat;
  /**
   * What a DETACHED payload means on this path, in the path's own words. The
   * wording is what tells a reader which door refused them.
   */
  payloadDetail: string;
}): VerifiedCoseStructure => {
  const tag = signedCoseStructureTag(kryptos);
  const sign1 = tag === COSE_TAG.sign1;
  const label = sign1 ? "COSE_Sign1" : "COSE_Mac0";

  const {
    protectedBstr,
    payload,
    signature,
    protectedHeader,
    unprotectedHeader,
    custom,
    protectedMap,
  } = splitSigned(token, {
    arity: { exactly: 4 },
    tags: [tag],
    error: CwsError,
    message: `Malformed ${label}`,
    title: `Malformed ${label}`,
    details: `A ${label} must be a 4-element array [protected, unprotected, payload, signature/tag].`,
  });

  // ⛔ Both PROTECTED-header gates — `crit`, then the algorithm-match — run ahead
  // of the signature cycle, so a hostile header is answered before any
  // cryptography is spent on it. The PROTECTED bucket alone: RFC 9052 §3.1.
  //
  // ⚠ CRIT FIRST, and the order is AEGIS POLICY, not a specification requirement.
  // Both wires share `assertProtectedHeaderGates`, so there is nothing left to
  // drift on which refusal a doubly-hostile token gets — it reports the crit
  // verdict. Reasons stated once there; do not restate them here as spec.
  assertProtectedHeaderGates({
    protectedHeader,
    custom: custom.protected,
    declared,
    expectedAlgorithm: kryptos.algorithm,
    format,
    error: ERROR_BY_FORMAT[format],
    algDetails:
      "The protected header alg does not match the algorithm of the configured kryptos key.",
  });

  // No aegis read path carries out-of-band content, so a detached (nil) payload
  // has nothing to authenticate — refused with the structural `cose_malformed`
  // verdict rather than a raw `Buffer.from(null)` TypeError outside `AegisError`.
  const content = requireAttachedPayload(payload, {
    error: CwsError,
    message: `Malformed ${label}`,
    title: `Malformed ${label}`,
    details: `The ${label} has a detached or nil payload, so ${payloadDetail}.`,
  });

  // The twin on the other nil-able slot: `exactly: 4` counts ELEMENTS, so `null`
  // in slot 4 clears the arity, algorithm and crit gates intact.
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

  return { protectedHeader, unprotectedHeader, custom, protectedMap, content };
};
