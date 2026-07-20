import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import {
  computeCoseKeyThumbprint,
  computeCoseKeyThumbprintUri,
  type CoseThumbprintHash,
} from "../internal/cose/cose-key-thumbprint.js";
import { coseToDomain, domainToCose } from "../internal/claims/translate.js";
import { isCose } from "../internal/cose/is-cose.js";
import { COSE_TAG } from "../internal/cose/structures.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { AegisError } from "../errors/index.js";
import type { OmitMode } from "../internal/utils/apply-omit.js";
import { CweKit } from "./CweKit.js";
import { CwmKit } from "./CwmKit.js";
import { CwtKit, type CwtDecoded } from "./CwtKit.js";

export type CoseKitSettings = {
  logger: ILogger;
  /** Clock skew tolerance (seconds) threaded to the in-kit temporal check. */
  clockTolerance: number;
};

export type CoseVerifyResult = {
  /** The DOMAIN-keyed claims (custom claims camelCased), the verified payload. */
  claims: Dict;
  /**
   * The COSE-name-keyed WIRE claims (the kit output before `coseToDomain`), fed
   * to the Aegis identity/presence validation — `exp`/`nbf`/`iss`/`aud`/… share
   * the JOSE names, so the JOSE matchers apply to it unchanged. Temporal claims
   * are `Date`s here (the codec's "date" kind).
   */
  wire: Dict;
  protectedHeader: Map<number, unknown>;
  typ: string | undefined;
};

export type CoseMintOptions = {
  /** COSE `typ` header (label 16) — the profile's COSE media type. */
  typ?: string;
  /** Allow lindorm-proprietary COSE encodings (default true); see encodeCwtClaims. */
  proprietary?: boolean;
  /**
   * How empty claims are pruned before encoding (threaded to CwtKit). `"empty"`
   * (default) drops null/empty-string/empty-array/empty-object recursively;
   * `"undefined"` drops only undefined.
   */
  omit?: OmitMode;
};

export type CoseEncryptOptions = {
  /** COSE `typ` header (label 16) on the COSE_Encrypt0. */
  typ?: string;
  /** The content-encryption algorithm; defaults to the key's own. */
  encryption?: KryptosEncryption;
};

// Strip an optional outer CWT tag (61) to reach the COSE structure.
const innerCose = (value: unknown): Tag | undefined => {
  const cose =
    value instanceof Tag && value.tag === COSE_TAG.cwt ? value.contents : value;
  return cose instanceof Tag ? cose : undefined;
};

/**
 * The COSE format facade — the COSE analogue of JoseKit, and the domain⇆wire
 * BOUNDARY (R18): Aegis hands it the resolved key + the DOMAIN-keyed common
 * claims and gets back / in a COSE token, so the wire kits below stay
 * transform-free. It translates domain→COSE wire on the way in (`domainToCose`)
 * and COSE wire→domain on the way out (`coseToDomain`).
 *
 * It DISPATCHES the integrity split off the resolved key's `algClass`: an
 * asymmetric key mints/verifies via `CwtKit` (COSE_Sign1), a symmetric `oct` key
 * via `CwmKit` (COSE_Mac0). Sign-then-encrypt wraps the secured CWT in a
 * COSE_Encrypt0 (`CweKit`).
 */
export class CoseKit {
  private readonly logger: ILogger;
  private readonly clockTolerance: number;

  constructor(options: CoseKitSettings) {
    this.logger = options.logger.child(["CoseKit"]);
    this.clockTolerance = options.clockTolerance;
  }

  /** Mint a secured CWT (COSE_Sign1 or COSE_Mac0) from the domain-keyed claims. */
  sign(kryptos: IKryptos, common: Dict, options: CoseMintOptions = {}): Buffer {
    return this.claimsKit(kryptos).sign(domainToCose(common), {
      typ: options.typ,
      proprietary: options.proprietary,
      omit: options.omit,
    });
  }

  /** Verify a CWT with an already-resolved key; returns the domain-keyed claims. */
  verify(kryptos: IKryptos, token: Buffer): CoseVerifyResult {
    const { claims: wire, protectedHeader, typ } = this.claimsKit(kryptos).verify(token);

    const { claims, custom } = coseToDomain(wire);

    return { claims: { ...claims, ...custom }, wire, protectedHeader, typ };
  }

  // The RESOLVED key's algClass picks the claims kit — the COSE integrity split
  // (CwtKit = Sign1/asymmetric, CwmKit = Mac0/symmetric); each kit re-asserts its
  // own class, so a mis-dispatch throws rather than mis-securing.
  private claimsKit(kryptos: IKryptos): CwtKit | CwmKit {
    switch (kryptos.algClass) {
      case "asymmetric":
        return new CwtKit({
          kryptos,
          logger: this.logger,
          clockTolerance: this.clockTolerance,
        });
      case "symmetric":
        return new CwmKit({
          kryptos,
          logger: this.logger,
          clockTolerance: this.clockTolerance,
        });
      default: {
        const exhaustive: never = kryptos.algClass;
        throw new AegisError("Unhandled COSE key class", {
          code: "cose_unhandled_alg_class",
          data: { algClass: String(exhaustive) },
          title: "Unhandled COSE Key Class",
          details:
            "The resolved key's algClass is neither asymmetric nor symmetric, so no COSE claims kit applies.",
        });
      }
    }
  }

  /** Decode the COSE headers (kid/alg/typ) WITHOUT verifying, for key resolution. */
  decode(token: Buffer): CwtDecoded {
    return CwtKit.decode(token);
  }

  /**
   * Wrap an already-secured CWT in a COSE_Encrypt0 (sign-then-encrypt). The
   * inner CWT bytes are the plaintext; the result is a bare COSE_Encrypt0.
   */
  encrypt(kryptos: IKryptos, inner: Buffer, options: CoseEncryptOptions = {}): Buffer {
    const encrypt0 = new CweKit({
      kryptos,
      logger: this.logger,
      encryption: options.encryption,
    }).encrypt(inner, { typ: options.typ });

    return Buffer.from(encodeCbor(encrypt0));
  }

  /**
   * True if these bytes are a recognised COSE token — a CWT (tag 61) wrapping a
   * COSE_Sign1/COSE_Mac0, or a bare COSE_Sign1 (18) / COSE_Mac0 (17) /
   * COSE_Encrypt0 (16). Tolerant: non-CBOR / non-COSE input returns false, so it
   * is safe to probe an unknown token with.
   */
  isCose(token: Buffer): boolean {
    return isCose(token);
  }

  /** True if the COSE token is an encrypted CWT (COSE_Encrypt0, tag 16). */
  isEncrypted(token: Buffer): boolean {
    return innerCose(decodeCbor(token))?.tag === COSE_TAG.encrypt0;
  }

  /** Read the COSE_Encrypt0 kid (unprotected, label 4) WITHOUT decrypting. */
  decodeEncryptedKid(token: Buffer): string | undefined {
    const cose = innerCose(decodeCbor(token));
    const unprotected = Array.isArray(cose?.contents)
      ? (cose.contents[1] as Map<number, unknown>)
      : undefined;
    const kid = unprotected?.get(coseByJose("kid"));
    return kid instanceof Uint8Array ? Buffer.from(kid).toString("utf8") : undefined;
  }

  /** Decrypt a COSE_Encrypt0 to its inner (secured) CWT bytes. */
  decrypt(kryptos: IKryptos, token: Buffer): Buffer {
    const cose = innerCose(decodeCbor(token));
    const { payload } = new CweKit({ kryptos, logger: this.logger }).decrypt(cose);
    return payload;
  }

  /**
   * The RFC 9679 COSE Key Thumbprint (`ckt`) of a key — the raw digest bytes
   * over the required-only COSE_Key. The COSE analogue of the JWK Thumbprint
   * (`jkt`); SHA-256 by default.
   */
  static thumbprint(kryptos: IKryptos, hash: CoseThumbprintHash = "sha-256"): Buffer {
    return computeCoseKeyThumbprint(kryptos.export("jwk") as Dict, hash);
  }

  /** The RFC 9679 §5.7 COSE Key Thumbprint URI (`urn:ietf:params:oauth:ckt:…`). */
  static thumbprintUri(kryptos: IKryptos, hash: CoseThumbprintHash = "sha-256"): string {
    return computeCoseKeyThumbprintUri(kryptos.export("jwk") as Dict, hash);
  }
}
