import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CwsError } from "../errors/index.js";
import type { ICwsKit } from "../interfaces/index.js";
import { algToCoseLabel } from "../internal/cose/alg-labels.js";
import { assertCoseRegistered } from "../internal/cose/assert-cose-registered.js";
import { Tag, encodeCbor } from "../internal/cose/cbor.js";
import type { CoseLabel } from "../internal/cose/cose-label.js";
import { ERROR_BY_FORMAT } from "../internal/cose/error-by-format.js";
import { requireAttachedPayload } from "../internal/cose/require-attached-payload.js";
import { requireSignature } from "../internal/cose/require-signature.js";
import { signedCoseStructureTag } from "../internal/cose/signed-cose-structure-tag.js";
import { splitSigned } from "../internal/cose/split-signed.js";
import { COSE_THUMBPRINT_SHA1 } from "../internal/cose/cose-thumbprint-sha1.js";
import { resolveWideCertBinding } from "../internal/cose/cose-wide-cert-binding.js";
import { verifyCoseStructure } from "../internal/cose/verify-cose-structure.js";
import { COSE_TAG, buildSecuredStructure } from "../internal/cose/structures.js";
import { buildCoseHeaders } from "../internal/header/build-cose-headers.js";
import { mergeCoseProtected } from "../internal/header/merge-cose-protected.js";
import { mergeCoseUnprotected } from "../internal/header/merge-cose-unprotected.js";
import { normaliseHeaders } from "../internal/header/normalise-headers.js";
import { KIT_CAPABILITIES } from "../internal/registry/kit-capabilities.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import { reconstructContent, serialiseContent } from "../internal/utils/content-codec.js";
import { resolveCertBinding } from "../internal/utils/resolve-cert-binding.js";
import { verifyCertBinding } from "../internal/utils/verify-cert-binding.js";
import type {
  CertificateBindingMode,
  CwsKitSettings,
  CoseDecodedUnstructuredToken,
  CoseSignUnstructuredTokenOptions,
  TokenContent,
  CoseVerifiedUnstructuredToken,
  VerifyUnstructuredTokenOptions,
  WireTokenHeader,
} from "../types/index.js";
import { SignatureKit } from "./SignatureKit.js";

/**
 * The OPAQUE COSE signer — the opaque sibling of `JwsKit`. It operates on an
 * opaque `Buffer` payload + the COSE STRUCTURE (a `Tag`), with no claim
 * knowledge; the CBOR encode/decode (and any outer CWT tag 61) is owned by the
 * layer above.
 *
 * ⚠ It serves the `cws` format and nothing else. `CwsKit`, `CwtKit` and `CwmKit`
 * are SIBLINGS over the same utils, the shape `JwsKit` and `JwtKit` already had.
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
  private readonly certBindingMode: CertificateBindingMode;

  constructor(options: CwsKitSettings) {
    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CwsKit"]);
    this.certBindingMode = options.certBindingMode ?? "strict";
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
  ): CoseDecodedUnstructuredToken<T> {
    // The outer CWT tag (61) and the structure's own tag are stripped by
    // `splitSigned` — symmetric with `verify`, which strips them too (aegis wraps
    // every signed COSE token in the CWT tag). A bare, un-enveloped token passes
    // through unchanged.
    const { protectedHeader, unprotectedHeader, custom, payload, signature } =
      splitSigned(token, {
        arity: { exactly: 4 },
        tags: [COSE_TAG.sign1, COSE_TAG.mac0],
        error: CwsError,
        message: "Malformed COSE structure",
        title: "Malformed COSE Structure",
        details:
          "A COSE_Sign1/COSE_Mac0 must be a 4-element array [protected, unprotected, payload, signature/tag].",
      });

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
      custom,
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
  sign(content: TokenContent, options: CoseSignUnstructuredTokenOptions = {}): Buffer {
    // Interop gate: a non-proprietary sign refuses an algorithm with no
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

    // A parameter that emits nothing is not a parameter, and the caller's bag is
    // normalised HERE because the codec below READS it — a builder normalisation
    // is too late. An empty `cty` would be preferred over the inferred type and
    // the payload would come back a Buffer; it would also reach label 3 as
    // `[3, ""]`, where the JOSE twin drops it, and the two wires would disagree
    // about the same call (`normalise-headers.ts`).
    const callerHeader = normaliseHeaders(options.header ?? {});

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
    // `aegis.jws.sign(dict)` and `aegis.cws.sign(dict)` + `verify` hand back the
    // same Dict, with no per-wire reasoning left for a caller to do.
    const { bytes, contentType } = serialiseContent(content, callerHeader.cty);

    const tag = signedCoseStructureTag(this.kryptos);
    const sign1 = tag === COSE_TAG.sign1;

    this.logger.debug(sign1 ? "Signing COSE_Sign1" : "MAC'ing COSE_Mac0", { options });

    const { protectedHeader, unprotected } = this.buildHeaders(
      contentType,
      callerHeader,
      options,
    );

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
  ): CoseVerifiedUnstructuredToken<T> {
    // The kit takes the ENCODED bytes and decodes internally (parallel to the
    // JOSE kits + to `sign` returning bytes).
    this.logger.debug("Verifying COSE structure", { options });

    // ⛔ ONE OPENING. The split, the two protected-header gates, the two
    // nil-able-slot refusals and the signature/MAC cycle are the SHARED signed
    // COSE read — byte-identical to the claims path's before it was extracted,
    // down to the `if (!valid) throw` block. The kit's own work is what follows:
    // reconstructing the OPAQUE content by its cty.
    const { protectedHeader, unprotectedHeader, custom, protectedMap, content } =
      verifyCoseStructure({
        kryptos: this.kryptos,
        token,
        declared: options.crit,
        format: "cws",
        payloadDetail: "there is no content to verify",
      });

    // Content tamper check: runs AFTER the signature/MAC has been verified with
    // the configured kryptos, exactly as `JwsKit.verify` does. NOT a key
    // selection step — header cert fields remain forbidden as key sources.
    //
    // Off the PROTECTED bucket alone: a binding the signature does not cover is
    // one any holder could rewrite. The two digests reach this bucket from ONE
    // COSE label — RFC 9360 §2's `x5t` (34), dispatched on its `hashAlg` member
    // by `internal/cose/cose-cert-hash.ts`.
    verifyCertBinding({
      header: {
        certificateThumbprint: protectedHeader["x5t#S256"],
        certificateThumbprintSha1: protectedHeader.x5t,
      },
      // The third digest has no domain field — see `cose-wide-cert-binding.ts`.
      computed: resolveWideCertBinding(protectedMap, this.kryptos),
      kryptos: this.kryptos,
      logger: this.logger,
      mode: options.certBindingMode ?? this.certBindingMode,
    });

    // Reconstruct by the PROTECTED cty: the signature/MAC is verified above,
    // BEFORE parsing, and the unprotected bucket covers nothing.
    return {
      protectedHeader,
      unprotectedHeader,
      custom,
      payload: reconstructContent<T>(content, protectedHeader.cty),
      token,
    };
  }

  // private — shared

  /**
   * Build the COSE_Sign1/Mac0 protected + unprotected header maps. `alg` is
   * derived onto the protected map and `kid` onto the unprotected map (COSE
   * convention: kid is an advisory routing hint read to resolve the verification
   * key before the signature is checked); the caller's `header` and `custom` bags
   * are then translated and merged under the reserved-param / crit / no-dup
   * rules. Scalar `typ` is sugar for the media-type PREFIX, never the whole typ.
   * `contentType` is the codec-inferred cty (label 3) default — a caller
   * `header.cty` wins as the WIRE label.
   *
   * The caller's protected bag arrives ALREADY NORMALISED (`sign` normalises it at
   * the door, before the codec reads its `cty`), which is why it is a parameter
   * rather than read off `options` here — reading `options.header` again would
   * re-admit the value the door removed.
   */
  private buildHeaders(
    contentType: string,
    header: Partial<WireTokenHeader>,
    options: CoseSignUnstructuredTokenOptions,
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
      header,
      custom: options.custom,
      cert: resolveCertBinding(
        this.kryptos,
        options.bindCertificate,
        COSE_THUMBPRINT_SHA1,
      ),
      proprietary: options.proprietary,
      format: "cws",
      error: ERROR_BY_FORMAT.cws,
    });

    return {
      // ⚠ The `crit` satisfaction check lives at the END of this call, on the
      // FINISHED protected bucket — the `alg`/`typ`/`cty` written here are part of
      // what a `crit` may name, and the caller's entries alone are not the message.
      protectedHeader: mergeCoseProtected({
        alg: algToCoseLabel(this.kryptos.algorithm),
        typ: buildMediaType(options.tokenType, "cws"),
        cty: contentType,
        entries: protectedEntries,
        proprietary: options.proprietary,
        format: "cws",
        error: ERROR_BY_FORMAT.cws,
      }),
      unprotected: mergeCoseUnprotected({
        kid: this.kryptos.id,
        entries: unprotectedEntries,
        proprietary: options.proprietary,
      }),
    };
  }
}
