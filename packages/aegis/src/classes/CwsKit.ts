import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CwsError } from "../errors/index.js";
import type { ICwsKit } from "../interfaces/index.js";
import { algToCoseLabel } from "../internal/cose/alg-labels.js";
import { assertCoseRegistered } from "../internal/cose/assert-cose-registered.js";
import { Tag, encodeCbor } from "../internal/cose/cbor.js";
import type { CoseLabel } from "../internal/cose/cose-label.js";
import {
  type CoseStructureTag,
  coseStructureTag,
} from "../internal/cose/cose-structure-tag.js";
import { ERROR_BY_FORMAT } from "../internal/cose/error-by-format.js";
import { requireAttachedPayload } from "../internal/cose/require-attached-payload.js";
import { requireSignature } from "../internal/cose/require-signature.js";
import { splitSigned } from "../internal/cose/split-signed.js";
import { COSE_TAG, buildSecuredStructure } from "../internal/cose/structures.js";
import { buildCoseHeaders } from "../internal/header/build-cose-headers.js";
import { mergeCoseProtected } from "../internal/header/merge-cose-protected.js";
import { mergeCoseUnprotected } from "../internal/header/merge-cose-unprotected.js";
import { KIT_CAPABILITIES } from "../internal/registry/kit-capabilities.js";
import { assertAlgorithmMatch } from "../internal/utils/assert-algorithm-match.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import { reconstructContent, serialiseContent } from "../internal/utils/content-codec.js";
import { rejectUnknownCritical } from "../internal/utils/reject-unknown-critical.js";
import type {
  DecodedUnstructuredToken,
  SignUnstructuredTokenOptions,
  TokenContent,
  VerifiedUnstructuredToken,
  VerifyUnstructuredTokenOptions,
  WireTokenHeader,
} from "../types/index.js";
import { SignatureKit } from "./SignatureKit.js";

export type CwsKitSettings = {
  kryptos: IKryptos;
  logger: ILogger;
};

/**
 * The OPAQUE COSE signer — the opaque sibling of `JwsKit`. It operates on an
 * opaque `Buffer` payload + the COSE STRUCTURE (a `Tag`), with no claim
 * knowledge; the CBOR encode/decode (and any outer CWT tag 61) is owned by the
 * layer above.
 *
 * ⚠ It serves the `cws` format and nothing else. It used to take a `format`
 * setting so the claims core could route `cwt`/`cwm` signing through it, which
 * made one kit the body of three and left the claims layer without a door of its
 * own. `CwsKit`, `CwtKit` and `CwmKit` are now SIBLINGS over the same utils, the
 * shape `JwsKit` and `JwtKit` already had.
 *
 * It GATES on the key's `algClass` itself (RFC 9052): an asymmetric key produces
 * a COSE_Sign1 (tag 18) over `Sig_structure` with the SAME primitive the JOSE ES*
 * path uses (raw r‖s), a symmetric `oct` key produces a COSE_Mac0 (tag 17) over
 * `MAC_structure` with the SAME HMAC primitive the JOSE HS* path uses — HMAC is a
 * MAC algorithm, never a Sign1 signature. One kit covers both because the opaque
 * payload has no claims layer to specialise; the claims split (`CwtKit` Sign1 /
 * `CwmKit` Mac0) sits one layer up.
 */
export class CwsKit implements ICwsKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;

  constructor(options: CwsKitSettings) {
    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CwsKit"]);
  }

  /**
   * WIRE decode (no signature/MAC check): decode the CBOR-encoded COSE token
   * (COSE_Sign1 tag 18 or COSE_Mac0 tag 17, tagged or bare) and translate its
   * protected + unprotected header maps into the two WIRE header buckets (integer
   * labels translated to their JOSE wire names), beside the opaque payload bytes
   * and the raw COSE signature/MAC bytes. The uniform primitive shared with
   * `JwsKit` decode.
   */
  static decode<T extends TokenContent = Buffer>(
    token: Buffer,
  ): DecodedUnstructuredToken<T, Buffer> {
    // The outer CWT tag (61) and the structure's own tag are stripped by
    // `splitSigned` — symmetric with `verify`, which strips them too (aegis wraps
    // every signed COSE token in the CWT tag). A bare, un-enveloped token passes
    // through unchanged.
    const { protectedHeader, unprotectedHeader, payload, signature } = splitSigned(
      token,
      {
        arity: { exactly: 4 },
        tags: [COSE_TAG.sign1, COSE_TAG.mac0],
        error: CwsError,
        message: "Malformed COSE structure",
        title: "Malformed COSE Structure",
        details:
          "A COSE_Sign1/COSE_Mac0 must be a 4-element array [protected, unprotected, payload, signature/tag].",
      },
    );

    // A DETACHED (nil) payload is legal COSE, but this kit carries no out-of-band
    // content, so there is nothing for it to decode — refused with the structural
    // `cose_malformed` verdict rather than a raw `Buffer.from(null)` TypeError.
    const content = requireAttachedPayload(payload, {
      error: CwsError,
      message: "Malformed COSE structure",
      title: "Malformed COSE Structure",
      details:
        "The COSE_Sign1/COSE_Mac0 has a detached or nil payload, so there is no content to decode.",
    });

    // The other nil-able slot: `exactly: 4` counts ELEMENTS, so a structure
    // carrying `null` in slot 4 arrives here intact. There is no signature to hand
    // back, and fabricating an empty Buffer for one would be a lie a caller cannot
    // tell from a real zero-length signature — refused with the same structural
    // verdict `verify` gives the same bytes.
    const secured = requireSignature(signature, {
      error: CwsError,
      message: "Malformed COSE structure",
      title: "Malformed COSE Structure",
      details:
        "The COSE_Sign1/COSE_Mac0 has a nil signature/tag, so the structure is incomplete.",
    });

    return {
      protectedHeader,
      unprotectedHeader,
      // Reconstruct by the PROTECTED cty alone: a content type the signature does
      // not cover cannot be allowed to decide how the payload is parsed.
      payload: reconstructContent<T>(content, protectedHeader.cty),
      signature: secured,
      token,
    };
  }

  /**
   * Sign the OPAQUE content and return the BARE encoded COSE token — the
   * CBOR-encoded COSE_Sign1 (asymmetric) or COSE_Mac0 (symmetric) bytes, nothing
   * else. COSE_Sign1 signs a `bstr`, so any content is faithful: the cty is
   * inferred (Dict→json, string→text, Buffer→octet), the bytes are serialised via
   * the shared codec, and the cty (label 3) rides the protected header so verify
   * round-trips the JS type. The outer CWT tag (61) framing is a concern of the
   * layer above.
   *
   * COSE_Sign1 and COSE_Mac0 differ in exactly three places — the tag, the
   * to-be-secured structure, and which SignatureKit mode secures it (Sign1 signs
   * RAW `r‖s`, Mac0 HMACs, which has no encoding to choose). Everything around
   * those three is one path.
   */
  sign(content: TokenContent, options: SignUnstructuredTokenOptions = {}): Buffer {
    // Interop gate (D5): a non-proprietary sign refuses an algorithm with no
    // OFFICIAL COSE-RFC registration so the token stays interoperable. Runs
    // before the Sign1/Mac0 split — it applies to both. Every current kryptos
    // signing algorithm is official (ML-DSA joined via RFC 9964), so this guards
    // only a future private-use algorithm; the enc-side (AES-CBC-HMAC) gate is
    // the reachable twin of this mechanism.
    assertCoseRegistered({
      kind: "alg",
      value: this.kryptos.algorithm,
      proprietary: options.proprietary,
      error: CwsError,
    });

    // The cty defaults to the inferred type; a caller `header.cty` wins as the
    // WIRE label (label 3).
    //
    // ⚠ `json`, not `cbor`, and it STAYS json — this is the settled answer, not
    // a placeholder. Where a specification fixes the encoding, aegis follows it:
    // RFC 8392 makes a CWT Claims Set a CBOR map, which is why `CwtKit`/`CwmKit`
    // write CBOR. Nothing fixes the encoding of OPAQUE caller content, so it
    // follows `@lindorm/aes` instead — a Dict is `application/json` and
    // reconstructs as a Dict — and `JwsKit`, `JweKit` and `CweKit` state the same
    // family. ONE encoding for opaque content across all four doors is what lets
    // `aegis.sign(dict)` + `verify` hand back the same Dict on `jws` and on
    // `cws`, with no per-wire reasoning left for a caller to do.
    const { bytes, contentType } = serialiseContent(content, options.header?.cty);

    const tag = this.structureTag();
    const sign1 = tag === COSE_TAG.sign1;

    this.logger.debug(sign1 ? "Signing COSE_Sign1" : "MAC'ing COSE_Mac0", { options });

    const { protectedHeader, unprotected } = this.buildHeaders(contentType, options);

    const secured = new SignatureKit({ kryptos: this.kryptos, raw: sign1 }).sign(
      buildSecuredStructure(tag, protectedHeader, bytes),
    );

    return encodeCbor(new Tag(tag, [protectedHeader, unprotected, bytes, secured]));
  }

  /**
   * Verify the token and return its two WIRE header buckets beside the
   * reconstructed content — the read twin of {@link sign}, differing in the same
   * three places and no others. Unwrapping, the header gates and the
   * reconstruction are ONE path for both structures.
   */
  verify<T extends TokenContent = Buffer>(
    token: Buffer,
    options: VerifyUnstructuredTokenOptions = {},
  ): VerifiedUnstructuredToken<T, Buffer> {
    // R2: the kit takes the ENCODED bytes and decodes internally (parallel to the
    // JOSE kits + to `sign` returning bytes). `certBindingMode` has no COSE
    // meaning — `KIT_CAPABILITIES.<cose>.certificateBinding` is `false` — so the
    // bag is recorded and not acted on; the parameter exists so the layer above
    // forwards its verify options structurally rather than naming fields.
    this.logger.debug("Verifying COSE structure", { options });

    const tag = this.structureTag();
    const sign1 = tag === COSE_TAG.sign1;
    const label = sign1 ? "COSE_Sign1" : "COSE_Mac0";
    const error = ERROR_BY_FORMAT.cws;

    const { protectedBstr, payload, signature, protectedHeader, unprotectedHeader } =
      splitSigned(token, {
        arity: { exactly: 4 },
        tags: [tag],
        error: CwsError,
        message: `Malformed ${label}`,
        title: `Malformed ${label}`,
        details: `A ${label} must be a 4-element array [protected, unprotected, payload, signature/tag].`,
      });

    // ⛔ The ORDER of the next two is the security property, so they stay HERE,
    // inline and ahead of the signature cycle, rather than moving into a shared
    // opener: `JwsKit.verify` runs the identical pair unextracted, and the two
    // wires must not be able to drift on when a hostile header is answered.

    // Algorithm-match, the gate the three JOSE kits have and this one did not: a
    // structure whose PROTECTED `alg` names an algorithm other than the resolved
    // key's is refused before the signature cycle, so a mismatch reports what is
    // wrong instead of surfacing as an opaque bad signature. The claims kits run
    // the same check on their own wire, under their own tag.
    assertAlgorithmMatch({
      actual: protectedHeader.alg as string | undefined,
      expected: this.kryptos.algorithm,
      format: "cws",
      error,
      details:
        "The protected header alg does not match the algorithm of the configured kryptos key.",
    });

    // `crit` (RFC 9052 §3.1), read from the PROTECTED bucket alone — the only one
    // the signature covers, and the only one the spec permits it in. Enforced
    // BEFORE the signature cycle, exactly as the JOSE kits do.
    rejectUnknownCritical({ header: protectedHeader, format: "cws", error });

    // A DETACHED (nil) payload is legal COSE, but this kit carries no out-of-band
    // content, so there is nothing for it to authenticate — refused with the
    // structural `cose_malformed` verdict rather than a raw `Buffer.from(null)`
    // TypeError, which would escape the `AegisError` contract entirely.
    const content = requireAttachedPayload(payload, {
      error: CwsError,
      message: `Malformed ${label}`,
      title: `Malformed ${label}`,
      details: `The ${label} has a detached or nil payload, so there is no content to verify.`,
    });

    // The twin of the payload check on the other nil-able slot: `exactly: 4`
    // counts ELEMENTS, so a structure with `null` in slot 4 clears the arity,
    // algorithm and crit gates intact. Refused with the structural verdict rather
    // than letting `Buffer.from(null)` throw a raw TypeError out of the contract.
    const secured = requireSignature(signature, {
      error: CwsError,
      message: `Malformed ${label}`,
      title: `Malformed ${label}`,
      details: `The ${label} has a nil ${sign1 ? "signature" : "authentication tag"}, so there is nothing to verify.`,
    });

    const valid = new SignatureKit({ kryptos: this.kryptos, raw: sign1 }).verify(
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

    // Reconstruct by the PROTECTED cty: the signature/MAC is verified above,
    // BEFORE parsing, and the unprotected bucket covers nothing.
    return {
      protectedHeader,
      unprotectedHeader,
      payload: reconstructContent<T>(content, protectedHeader.cty),
      token,
    };
  }

  // private — shared

  /**
   * Which COSE integrity structure this kit's key implies (RFC 9052 §4.4 / §6.3)
   * — the ONE gate, asked identically by both verbs.
   */
  private structureTag(): CoseStructureTag {
    return coseStructureTag({
      algClass: this.kryptos.algClass,
      error: CwsError,
      details:
        "The resolved key's algClass is neither asymmetric nor symmetric, so no COSE integrity structure applies.",
    });
  }

  /**
   * Build the COSE_Sign1/Mac0 protected + unprotected header maps. `alg` is
   * derived onto the protected map and `kid` onto the unprotected map (COSE
   * convention: kid is an advisory routing hint read to resolve the verification
   * key before the signature is checked); the caller's `header`/`unprotected`
   * bags are then translated and merged under the reserved-param / crit / no-dup
   * rules. Scalar `typ` is sugar for the media-type PREFIX, never the whole typ.
   * `contentType` is the codec-inferred cty (label 3) default — a caller
   * `header.cty` wins as the WIRE label.
   */
  private buildHeaders(
    contentType: string,
    options: SignUnstructuredTokenOptions,
  ): {
    protectedHeader: Buffer;
    unprotected: Map<CoseLabel, unknown>;
  } {
    // `typ` (label 16) is the kit-computed media type from the `tokenType` PREFIX
    // (the media-type family is the opaque `+cws` one) and `cty` (label 3) is the
    // codec-inferred content type; both land PROTECTED. `typ` is RESERVED — a
    // caller value for it is REFUSED by `buildCoseHeaders`, not merged, because
    // `typ` is what routes a COSE token. `cty` is not: a caller may relabel the
    // content, and `serialiseContent` has already honoured that above, so writing
    // it here and letting the caller's copy overwrite it is a no-op.
    //
    // ⚠ `proprietary` decides the SPELLING of a private-use label here, the same
    // way it does for a private-use claim label: with the interoperable default
    // a caller's `oid` rides the string label, not the lindorm integer a foreign
    // reader cannot interpret.
    const { protectedEntries, unprotectedEntries } = buildCoseHeaders({
      reserved: KIT_CAPABILITIES.cws.reserved,
      header: options.header as Partial<WireTokenHeader> | undefined,
      unprotected: options.unprotected,
      proprietary: options.proprietary,
      error: ERROR_BY_FORMAT.cws,
    });

    return {
      protectedHeader: mergeCoseProtected({
        alg: algToCoseLabel(this.kryptos.algorithm),
        typ: buildMediaType(options.tokenType, "cws"),
        cty: contentType,
        entries: protectedEntries,
        proprietary: options.proprietary,
      }),
      unprotected: mergeCoseUnprotected({
        kid: this.kryptos.id,
        entries: unprotectedEntries,
        proprietary: options.proprietary,
      }),
    };
  }
}
