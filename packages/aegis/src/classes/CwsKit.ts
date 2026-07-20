import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CwsError } from "../errors/index.js";
import { algToCoseLabel, isOfficialCoseAlg } from "../internal/cose/alg-labels.js";
import { Tag } from "../internal/cose/cbor.js";
import {
  COSE_TAG,
  buildMacStructure,
  buildSigStructure,
  decodeProtectedHeader,
  encodeProtectedHeader,
} from "../internal/cose/structures.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { SignatureKit } from "./SignatureKit.js";

export type CwsKitSettings = {
  kryptos: IKryptos;
  logger: ILogger;
};

export type CwsSignOptions = {
  /** COSE `typ` header (label 16, RFC 9596) — the profile's COSE media type. */
  typ?: string;
  /**
   * Allow a lindorm-proprietary (private-use) COSE algorithm label (default
   * `true`). When omitted (or `true`) a private-use alg such as ML-DSA is
   * permitted; set `false` for strict COSE-RFC interoperability, where the
   * signing algorithm MUST carry an OFFICIAL COSE-RFC label or `sign` throws (the
   * interop gate). Read/verify is always lenient.
   */
  proprietary?: boolean;
};

export type CwsVerifyResult = {
  payload: Buffer;
  protectedHeader: Map<number, unknown>;
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
export class CwsKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;

  constructor(options: CwsKitSettings) {
    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CwsKit"]);
  }

  sign(payload: Buffer, options: CwsSignOptions = {}): Tag {
    // Interop gate: proprietary is the default, so a private-use algorithm (e.g.
    // ML-DSA) is allowed unless the caller EXPLICITLY opts into interoperable
    // mode (`proprietary: false`), which refuses an algorithm with no OFFICIAL
    // COSE-RFC registration. Runs before the Sign1/Mac0 split — applies to both.
    if (options.proprietary === false && !isOfficialCoseAlg(this.kryptos.algorithm)) {
      throw new CwsError(
        `Algorithm "${this.kryptos.algorithm}" has no official COSE registration`,
        {
          code: "cose_alg_not_registered",
          data: { algorithm: this.kryptos.algorithm },
          title: "COSE Algorithm Not Registered",
          details:
            "In interoperable (non-proprietary) mode the signing algorithm must carry an official COSE-RFC label; ML-DSA and other private-use algorithms require proprietary mode.",
        },
      );
    }

    switch (this.kryptos.algClass) {
      case "asymmetric":
        return this.signSign1(payload, options);
      case "symmetric":
        return this.macMac0(payload, options);
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

  verify(structure: unknown): CwsVerifyResult {
    switch (this.kryptos.algClass) {
      case "asymmetric":
        return this.verifySign1(structure);
      case "symmetric":
        return this.verifyMac0(structure);
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

  private signSign1(payload: Buffer, options: CwsSignOptions): Tag {
    this.logger.debug("Signing COSE_Sign1", { options });

    const protectedHeader = this.protectedHeader(options);

    // kid travels UNprotected — it is read to resolve the verification key
    // before the signature is checked (amphora kid-only resolution).
    const unprotected = new Map<number, unknown>();
    unprotected.set(coseByJose("kid"), Buffer.from(this.kryptos.id, "utf8"));

    const toBeSigned = buildSigStructure(protectedHeader, payload);
    const signature = new SignatureKit({ kryptos: this.kryptos, raw: true }).sign(
      toBeSigned,
    );

    return new Tag(COSE_TAG.sign1, [protectedHeader, unprotected, payload, signature]);
  }

  private verifySign1(structure: unknown): CwsVerifyResult {
    const [protectedHeader, , payload, signature] = unwrapStructure(
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

    return {
      payload: Buffer.from(payload),
      protectedHeader: decodeProtectedHeader(protectedHeader),
    };
  }

  // private — COSE_Mac0 (RFC 9052 §6.2)

  private macMac0(payload: Buffer, options: CwsSignOptions): Tag {
    this.logger.debug("MAC'ing COSE_Mac0", { options });

    const protectedHeader = this.protectedHeader(options);

    const unprotected = new Map<number, unknown>();
    unprotected.set(coseByJose("kid"), Buffer.from(this.kryptos.id, "utf8"));

    const toBeMaced = buildMacStructure(protectedHeader, payload);
    const tag = new SignatureKit({ kryptos: this.kryptos }).sign(toBeMaced);

    return new Tag(COSE_TAG.mac0, [protectedHeader, unprotected, payload, tag]);
  }

  private verifyMac0(structure: unknown): CwsVerifyResult {
    const [protectedHeader, , payload, tag] = unwrapStructure(
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

    return {
      payload: Buffer.from(payload),
      protectedHeader: decodeProtectedHeader(protectedHeader),
    };
  }

  // private — shared

  private protectedHeader(options: CwsSignOptions): Buffer {
    const protectedMap = new Map<number, unknown>();
    protectedMap.set(coseByJose("alg"), algToCoseLabel(this.kryptos.algorithm));
    if (options.typ !== undefined) protectedMap.set(coseByJose("typ"), options.typ);
    return encodeProtectedHeader(protectedMap);
  }
}
