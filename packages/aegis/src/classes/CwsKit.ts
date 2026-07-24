import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CwsError } from "../errors/index.js";
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
import { buildCoseHeaders } from "../internal/header/build-cose-headers.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { mergeCoseWireHeader } from "../internal/header/merge-cose-wire-header.js";
import { reconstructContent, serialiseContent } from "../internal/utils/content-codec.js";
import { buildMediaType, type KitFormat } from "../internal/utils/compute-typ-header.js";
import type {
  DecodedUnstructuredToken,
  SignUnstructuredTokenOptions,
  TokenContent,
  VerifiedUnstructuredToken,
  WireTokenHeader,
} from "../types/index.js";
import { SignatureKit } from "./SignatureKit.js";

export type CwsKitSettings = {
  kryptos: IKryptos;
  logger: ILogger;
  /**
   * The COSE media-type FAMILY the kit stamps on `typ` (label 16), built from the
   * `tokenType` prefix: `"cws"` (default) → `application/<prefix>+cws` so a direct
   * opaque token is recognised as a CWS; `"cwt"`/`"cwm"` → `application/<prefix>+cwt`
   * for the CWT/CWM claims kits that delegate the COSE signing here. The signer is
   * otherwise format-agnostic — only the media-type family differs.
   */
  typFormat?: Extract<KitFormat, "cws" | "cwt" | "cwm">;
};

const unwrapStructure = (value: unknown, tag: number, label: string): Array<unknown> => {
  const contents = value instanceof Tag && value.tag === tag ? value.contents : value;
  if (!Array.isArray(contents) || contents.length !== 4) {
    throw new CwsError(`Malformed ${label}`, {
      code: "cose_malformed",
      title: `Malformed ${label}`,
      details: `A ${label} must be a 4-element array [protected, unprotected, payload, signature/tag].`,
    });
  }
  return contents;
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
  private readonly typFormat: Extract<KitFormat, "cws" | "cwt" | "cwm">;

  constructor(options: CwsKitSettings) {
    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CwsKit"]);
    this.typFormat = options.typFormat ?? "cws";
  }

  /**
   * WIRE decode (no signature/MAC check): decode the CBOR-encoded COSE token
   * (COSE_Sign1 tag 18 or COSE_Mac0 tag 17, tagged or bare), merge its protected
   * + unprotected header maps into ONE {@link DecodedUnstructuredToken} wire
   * header (integer labels translated to their JOSE wire names), and surface the
   * opaque payload bytes + the raw COSE signature/MAC bytes. The uniform
   * primitive shared with `JwsKit` decode.
   */
  static decode<T extends TokenContent = Buffer>(
    token: Buffer,
  ): DecodedUnstructuredToken<T, Buffer> {
    // Strip an optional outer CWT tag (61) to reach the COSE_Sign1/Mac0 —
    // symmetric with `verify`, which strips it too (aegis wraps every signed COSE
    // token in the CWT tag). A bare, un-enveloped token passes through unchanged.
    const decoded = decodeCbor(token);
    const value =
      decoded instanceof Tag && decoded.tag === COSE_TAG.cwt ? decoded.contents : decoded;
    const contents =
      value instanceof Tag &&
      (value.tag === COSE_TAG.sign1 || value.tag === COSE_TAG.mac0)
        ? value.contents
        : value;

    if (!Array.isArray(contents) || contents.length !== 4) {
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

    const header = mergeCoseWireHeader(
      decodeProtectedHeader(protectedBstr),
      unprotected instanceof Map ? unprotected : undefined,
      "sig",
    );

    return {
      header,
      payload: reconstructContent<T>(Buffer.from(payload), header.cty),
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
  ): VerifiedUnstructuredToken<T, Buffer> {
    // R2: the kit takes the ENCODED bytes and decodes internally (parallel to the
    // JOSE kits + to `sign` returning bytes). Strip an optional outer CWT tag (61)
    // to reach the COSE_Sign1/Mac0 the algClass split verifies.
    const decoded = decodeCbor(token);
    const structure =
      decoded instanceof Tag && decoded.tag === COSE_TAG.cwt ? decoded.contents : decoded;

    switch (this.kryptos.algClass) {
      case "asymmetric":
        return this.verifySign1<T>(structure, token);
      case "symmetric":
        return this.verifyMac0<T>(structure, token);
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

  // private — COSE_Sign1 (RFC 9052 §4.4)

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

  private verifySign1<T extends TokenContent = Buffer>(
    structure: unknown,
    token: Buffer,
  ): VerifiedUnstructuredToken<T, Buffer> {
    const [protectedHeader, unprotected, payload, signature] = unwrapStructure(
      structure,
      COSE_TAG.sign1,
      "COSE_Sign1",
    ) as [Uint8Array, unknown, Uint8Array, Uint8Array];

    const toBeSigned = buildSigStructure(
      Buffer.from(protectedHeader),
      Buffer.from(payload),
    );
    const valid = new SignatureKit({ kryptos: this.kryptos, raw: true }).verify(
      toBeSigned,
      Buffer.from(signature),
    );

    if (!valid) {
      throw new CwsError("Invalid COSE_Sign1 signature", {
        code: "cose_signature_invalid",
        title: "Invalid COSE Signature",
        details: "The COSE_Sign1 signature did not verify against the resolved key.",
      });
    }

    const header = mergeCoseWireHeader(
      decodeProtectedHeader(protectedHeader),
      unprotected instanceof Map ? unprotected : undefined,
      "sig",
    );

    // Reconstruct-by-cty is SAFE: the signature is verified above, BEFORE parsing.
    return {
      payload: reconstructContent<T>(Buffer.from(payload), header.cty),
      header,
      token,
    };
  }

  // private — COSE_Mac0 (RFC 9052 §6.2)

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

  private verifyMac0<T extends TokenContent = Buffer>(
    structure: unknown,
    token: Buffer,
  ): VerifiedUnstructuredToken<T, Buffer> {
    const [protectedHeader, unprotected, payload, tag] = unwrapStructure(
      structure,
      COSE_TAG.mac0,
      "COSE_Mac0",
    ) as [Uint8Array, unknown, Uint8Array, Uint8Array];

    const toBeMaced = buildMacStructure(
      Buffer.from(protectedHeader),
      Buffer.from(payload),
    );
    const valid = new SignatureKit({ kryptos: this.kryptos }).verify(
      toBeMaced,
      Buffer.from(tag),
    );

    if (!valid) {
      throw new CwsError("Invalid COSE_Mac0 tag", {
        code: "cose_mac_invalid",
        title: "Invalid COSE MAC",
        details:
          "The COSE_Mac0 authentication tag did not verify against the resolved key.",
      });
    }

    const header = mergeCoseWireHeader(
      decodeProtectedHeader(protectedHeader),
      unprotected instanceof Map ? unprotected : undefined,
      "sig",
    );

    // Reconstruct-by-cty is SAFE: the MAC is verified above, BEFORE parsing.
    return {
      payload: reconstructContent<T>(Buffer.from(payload), header.cty),
      header,
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
   * rules. Scalar `typ` is sugar for `header.typ` (an explicit `header.typ` wins).
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
    const protectedMap = new Map<number, unknown>();
    protectedMap.set(coseByJose("alg"), algToCoseLabel(this.kryptos.algorithm));

    const unprotected = new Map<number, unknown>();
    unprotected.set(coseByJose("kid"), Buffer.from(this.kryptos.id, "utf8"));

    // `typ` (label 16) is the kit-computed media type from the `tokenType` PREFIX
    // (the media-type family is this kit's `typFormat`); it is NOT settable via the
    // header bag (KitOwned). `cty` (label 3) defaults to the inferred content type
    // and lands in the PROTECTED map; a caller `header.cty` wins. The caller's
    // protected bag adds around them.
    const header: Partial<WireTokenHeader> = {
      typ: buildMediaType(options.tokenType, this.typFormat),
      cty: contentType,
      ...options.header,
    };

    const { protectedEntries, unprotectedEntries } = buildCoseHeaders({
      reserved: new Set([coseByJose("alg"), coseByJose("kid")]),
      header,
      unprotected: options.unprotected,
      error: CwsError,
    });

    for (const [label, value] of protectedEntries) protectedMap.set(label, value);
    for (const [label, value] of unprotectedEntries) unprotected.set(label, value);

    return { protectedHeader: encodeProtectedHeader(protectedMap), unprotected };
  }
}
