import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CwsError, CwtError, CwmError, type CoseError } from "../errors/index.js";
import type { ICwsKit } from "../interfaces/index.js";
import { algToCoseLabel, isOfficialCoseAlg } from "../internal/cose/alg-labels.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import {
  COSE_TAG,
  buildMacStructure,
  buildSigStructure,
  decodeProtectedHeader,
  encodeProtectedHeader,
} from "../internal/cose/structures.js";
import { unwrapCose } from "../internal/cose/unwrap-cose.js";
import { buildCoseHeaders } from "../internal/header/build-cose-headers.js";
import { coseWireHeader } from "../internal/header/cose-wire-header.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { KIT_CAPABILITIES } from "../internal/registry/kit-capabilities.js";
import { reconstructContent, serialiseContent } from "../internal/utils/content-codec.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import { rejectUnknownCritical } from "../internal/utils/reject-unknown-critical.js";
import type {
  DecodedUnstructuredToken,
  SignUnstructuredTokenOptions,
  TokenContent,
  TokenFormatTag,
  VerifiedUnstructuredToken,
  VerifyUnstructuredTokenOptions,
  WireTokenHeader,
} from "../types/index.js";
import { SignatureKit } from "./SignatureKit.js";

/**
 * The three COSE signed formats this one signer serves. It is the FORMAT, not
 * merely a media-type family: it picks the `typ` the kit stamps, the capability
 * row it enforces, and the namespace of the errors it raises.
 */
export type CwsKitFormat = Extract<TokenFormatTag, "cws" | "cwt" | "cwm">;

export type CwsKitSettings = {
  kryptos: IKryptos;
  logger: ILogger;
  /**
   * Which COSE signed format this kit is serving: `"cws"` (default) for a direct
   * opaque token — `typ` becomes `application/<prefix>+cws` — or `"cwt"`/`"cwm"`
   * for the claims kits that delegate their COSE signing here, whose `typ` is
   * `application/<prefix>+cwt`. The signer is otherwise format-agnostic: the
   * COSE_Sign1/COSE_Mac0 split is decided by the KEY's `algClass`, not by this.
   */
  format?: CwsKitFormat;
};

/** The leaf error class for each signed COSE format, so a throw lands on its own namespace. */
const COSE_ERROR: Record<CwsKitFormat, typeof CoseError> = {
  cws: CwsError,
  cwt: CwtError,
  cwm: CwmError,
};

/**
 * The sole opaque COSE signer — the opaque sibling of `JwsKit`. It operates on an
 * opaque `Buffer` payload + the COSE STRUCTURE (a `Tag`), with no claim
 * knowledge; the CBOR encode/decode (and any outer CWT tag 61) is owned by the
 * layer above.
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
  private readonly format: CwsKitFormat;

  constructor(options: CwsKitSettings) {
    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CwsKit"]);
    this.format = options.format ?? "cws";
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
    // `unwrapCose` — symmetric with `verify`, which strips them too (aegis wraps
    // every signed COSE token in the CWT tag). A bare, un-enveloped token passes
    // through unchanged.
    const contents = unwrapCose(decodeCbor(token), {
      arity: { exactly: 4 },
      tags: [COSE_TAG.sign1, COSE_TAG.mac0],
    });

    if (!contents) {
      throw new CwsError("Malformed COSE structure", {
        code: "cose_malformed",
        title: "Malformed COSE Structure",
        details:
          "A COSE_Sign1/COSE_Mac0 must be a 4-element array [protected, unprotected, payload, signature/tag].",
      });
    }

    const [protectedBstr, unprotected, payload, signature] = contents as [
      Uint8Array,
      Map<number, unknown> | undefined,
      Uint8Array,
      Uint8Array,
    ];

    const protectedHeader = coseWireHeader(decodeProtectedHeader(protectedBstr), "sig");

    return {
      protectedHeader,
      unprotectedHeader: coseWireHeader(
        unprotected instanceof Map ? unprotected : undefined,
        "sig",
      ),
      // Reconstruct by the PROTECTED cty alone: a content type the signature does
      // not cover cannot be allowed to decide how the payload is parsed.
      payload: reconstructContent<T>(Buffer.from(payload), protectedHeader.cty),
      signature: Buffer.from(signature),
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
   */
  sign(content: TokenContent, options: SignUnstructuredTokenOptions = {}): Buffer {
    // Interop gate (D5): a non-proprietary sign refuses an algorithm with no
    // OFFICIAL COSE-RFC registration so the token stays interoperable. Runs
    // before the Sign1/Mac0 split — it applies to both. Every current kryptos
    // signing algorithm is official (ML-DSA joined via RFC 9964), so this guards
    // only a future private-use algorithm; the enc-side (AES-CBC-HMAC) gate is
    // the reachable twin of this mechanism.
    if (!options.proprietary && !isOfficialCoseAlg(this.kryptos.algorithm)) {
      throw new CwsError(
        `Algorithm "${this.kryptos.algorithm}" has no official COSE registration`,
        {
          code: "cose_alg_not_registered",
          data: { algorithm: this.kryptos.algorithm },
          title: "COSE Algorithm Not Registered",
          details:
            "In interoperable (non-proprietary) mode the signing algorithm must carry an official COSE-RFC label; a private-use algorithm requires proprietary mode.",
        },
      );
    }

    // The cty defaults to the inferred type; a caller `header.cty` wins as the
    // WIRE label (label 3).
    const { bytes, contentType } = serialiseContent(content, options.header?.cty);

    switch (this.kryptos.algClass) {
      case "asymmetric":
        return encodeCbor(this.signSign1(bytes, contentType, options));
      case "symmetric":
        return encodeCbor(this.macMac0(bytes, contentType, options));
      default: {
        const exhaustive: never = this.kryptos.algClass;
        throw new CwsError("Unhandled COSE key class", {
          code: "cose_unhandled_alg_class",
          data: { algClass: String(exhaustive) },
          title: "Unhandled COSE Key Class",
          details:
            "The resolved key's algClass is neither asymmetric nor symmetric, so no COSE integrity structure applies.",
        });
      }
    }
  }

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

    const decoded = decodeCbor(token);

    switch (this.kryptos.algClass) {
      case "asymmetric":
        return this.verifyStructure<T>(decoded, token, COSE_TAG.sign1);
      case "symmetric":
        return this.verifyStructure<T>(decoded, token, COSE_TAG.mac0);
      default: {
        const exhaustive: never = this.kryptos.algClass;
        throw new CwsError("Unhandled COSE key class", {
          code: "cose_unhandled_alg_class",
          data: { algClass: String(exhaustive) },
          title: "Unhandled COSE Key Class",
          details:
            "The resolved key's algClass is neither asymmetric nor symmetric, so no COSE integrity structure applies.",
        });
      }
    }
  }

  // private — the two integrity structures (RFC 9052 §4.4 / §6.3)

  private signSign1(
    payload: Buffer,
    contentType: string,
    options: SignUnstructuredTokenOptions,
  ): Tag {
    this.logger.debug("Signing COSE_Sign1", { options });

    const { protectedHeader, unprotected } = this.buildHeaders(contentType, options);

    const toBeSigned = buildSigStructure(protectedHeader, payload);
    const signature = new SignatureKit({ kryptos: this.kryptos, raw: true }).sign(
      toBeSigned,
    );

    return new Tag(COSE_TAG.sign1, [protectedHeader, unprotected, payload, signature]);
  }

  private macMac0(
    payload: Buffer,
    contentType: string,
    options: SignUnstructuredTokenOptions,
  ): Tag {
    this.logger.debug("MAC'ing COSE_Mac0", { options });

    const { protectedHeader, unprotected } = this.buildHeaders(contentType, options);

    const toBeMaced = buildMacStructure(protectedHeader, payload);
    const tag = new SignatureKit({ kryptos: this.kryptos }).sign(toBeMaced);

    return new Tag(COSE_TAG.mac0, [protectedHeader, unprotected, payload, tag]);
  }

  /**
   * Verify ONE signed COSE structure. COSE_Sign1 and COSE_Mac0 differ only in
   * their tag, their to-be-secured structure and which SignatureKit mode secures
   * it; everything around that — unwrapping, the header gates, reconstruction —
   * is identical, and used to be written twice.
   */
  private verifyStructure<T extends TokenContent = Buffer>(
    value: unknown,
    token: Buffer,
    tag: typeof COSE_TAG.sign1 | typeof COSE_TAG.mac0,
  ): VerifiedUnstructuredToken<T, Buffer> {
    const sign1 = tag === COSE_TAG.sign1;
    const label = sign1 ? "COSE_Sign1" : "COSE_Mac0";
    const error = COSE_ERROR[this.format];

    const contents = unwrapCose(value, { arity: { exactly: 4 }, tags: [tag] });

    if (!contents) {
      throw new CwsError(`Malformed ${label}`, {
        code: "cose_malformed",
        title: `Malformed ${label}`,
        details: `A ${label} must be a 4-element array [protected, unprotected, payload, signature/tag].`,
      });
    }

    const [protectedBstr, unprotected, payload, signature] = contents as [
      Uint8Array,
      unknown,
      Uint8Array,
      Uint8Array,
    ];

    const protectedHeader = coseWireHeader(decodeProtectedHeader(protectedBstr), "sig");

    // Algorithm-match, the gate the three JOSE kits have and this one did not: a
    // structure whose PROTECTED `alg` names an algorithm other than the resolved
    // key's is refused before the signature cycle, so a mismatch reports what is
    // wrong instead of surfacing as an opaque bad signature. The claims layer
    // above used to run this same check itself, off its own header decode.
    const algorithm = protectedHeader.alg as string | undefined;

    if (algorithm !== this.kryptos.algorithm) {
      throw new error("Invalid token", {
        code: `${this.format}_algorithm_mismatch`,
        data: { algorithm },
        debug: { expected: this.kryptos.algorithm },
        title: `${this.format.toUpperCase()} Algorithm Mismatch`,
        details:
          "The protected header alg does not match the algorithm of the configured kryptos key.",
      });
    }

    // `crit` (RFC 9052 §3.1), read from the PROTECTED bucket alone — the only one
    // the signature covers, and the only one the spec permits it in. Enforced
    // BEFORE the signature cycle, exactly as the JOSE kits do.
    rejectUnknownCritical({ header: protectedHeader, format: this.format, error });

    const toBeSecured = sign1
      ? buildSigStructure(Buffer.from(protectedBstr), Buffer.from(payload))
      : buildMacStructure(Buffer.from(protectedBstr), Buffer.from(payload));

    const valid = new SignatureKit({ kryptos: this.kryptos, raw: sign1 }).verify(
      toBeSecured,
      Buffer.from(signature),
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
      unprotectedHeader: coseWireHeader(
        unprotected instanceof Map ? unprotected : undefined,
        "sig",
      ),
      payload: reconstructContent<T>(Buffer.from(payload), protectedHeader.cty),
      token,
    };
  }

  // private — shared

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
    unprotected: Map<number, unknown>;
  } {
    // `typ` (label 16) is the kit-computed media type from the `tokenType` PREFIX
    // (the media-type family is this kit's `format`) and `cty` (label 3) is the
    // codec-inferred content type; both land PROTECTED. `typ` is RESERVED — a
    // caller value for it is REFUSED by `buildCoseHeaders`, not merged, because
    // `typ` is what routes a COSE token. `cty` is not: a caller may relabel the
    // content, and `serialiseContent` has already honoured that above, so writing
    // it here and letting the caller's copy overwrite it is a no-op.
    const protectedMap = new Map<number, unknown>();
    protectedMap.set(coseByJose("alg"), algToCoseLabel(this.kryptos.algorithm));
    protectedMap.set(coseByJose("typ"), buildMediaType(options.tokenType, this.format));
    protectedMap.set(coseByJose("cty"), contentType);

    const unprotected = new Map<number, unknown>();
    unprotected.set(coseByJose("kid"), Buffer.from(this.kryptos.id, "utf8"));

    const { protectedEntries, unprotectedEntries } = buildCoseHeaders({
      reserved: KIT_CAPABILITIES[this.format].reserved,
      header: options.header as Partial<WireTokenHeader> | undefined,
      unprotected: options.unprotected,
      error: COSE_ERROR[this.format],
    });

    for (const [label, value] of protectedEntries) protectedMap.set(label, value);
    for (const [label, value] of unprotectedEntries) unprotected.set(label, value);

    return { protectedHeader: encodeProtectedHeader(protectedMap), unprotected };
  }
}
