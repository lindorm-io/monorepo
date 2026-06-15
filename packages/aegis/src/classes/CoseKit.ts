import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { COSE_HEADER, COSE_TAG } from "../internal/cose/structures.js";
import { CweKit } from "./CweKit.js";
import { CwtKit, type CwtDecoded, type CwtVerifyResult } from "./CwtKit.js";

export type CoseKitOptions = {
  logger: ILogger;
};

export type CoseMintOptions = {
  /** COSE `typ` header (label 16) — the profile's COSE media type. */
  typ?: string;
  /** Allow lindorm-proprietary COSE encodings (default true); see encodeCwtClaims. */
  proprietary?: boolean;
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
 * The COSE format facade — the COSE analogue of JoseKit. Aegis
 * hands it the resolved key + the DOMAIN-keyed common claims and gets back / in
 * a COSE token, so Aegis itself never touches the COSE wire kits.
 *
 * It issues signed (COSE_Sign1) and MAC'd (COSE_Mac0) CWTs — chosen by key type
 * inside CwtKit — and wraps them in a COSE_Encrypt0 for sign-then-encrypt.
 */
export class CoseKit {
  private readonly logger: ILogger;

  public constructor(options: CoseKitOptions) {
    this.logger = options.logger.child(["CoseKit"]);
  }

  /** Mint a secured CWT (COSE_Sign1 or COSE_Mac0) from the domain-keyed claims. */
  public sign(kryptos: IKryptos, common: Dict, options: CoseMintOptions = {}): Buffer {
    return new CwtKit({ kryptos, logger: this.logger }).sign(common, options);
  }

  /** Verify a CWT with an already-resolved key; returns the domain-keyed claims. */
  public verify(kryptos: IKryptos, token: Buffer): CwtVerifyResult {
    return new CwtKit({ kryptos, logger: this.logger }).verify(token);
  }

  /** Decode the COSE headers (kid/alg/typ) WITHOUT verifying, for key resolution. */
  public decode(token: Buffer): CwtDecoded {
    return CwtKit.decode(token);
  }

  /**
   * Wrap an already-secured CWT in a COSE_Encrypt0 (sign-then-encrypt). The
   * inner CWT bytes are the plaintext; the result is a bare COSE_Encrypt0.
   */
  public encrypt(
    kryptos: IKryptos,
    inner: Buffer,
    options: CoseEncryptOptions = {},
  ): Buffer {
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
  public isCose(token: Buffer): boolean {
    try {
      const tag = innerCose(decodeCbor(token))?.tag;
      return tag === COSE_TAG.sign1 || tag === COSE_TAG.mac0 || tag === COSE_TAG.encrypt0;
    } catch {
      return false;
    }
  }

  /** True if the COSE token is an encrypted CWT (COSE_Encrypt0, tag 16). */
  public isEncrypted(token: Buffer): boolean {
    return innerCose(decodeCbor(token))?.tag === COSE_TAG.encrypt0;
  }

  /** Read the COSE_Encrypt0 kid (unprotected, label 4) WITHOUT decrypting. */
  public decodeEncryptedKid(token: Buffer): string | undefined {
    const cose = innerCose(decodeCbor(token));
    const unprotected = Array.isArray(cose?.contents)
      ? (cose.contents[1] as Map<number, unknown>)
      : undefined;
    const kid = unprotected?.get(COSE_HEADER.kid);
    return kid instanceof Uint8Array ? Buffer.from(kid).toString("utf8") : undefined;
  }

  /** Decrypt a COSE_Encrypt0 to its inner (secured) CWT bytes. */
  public decrypt(kryptos: IKryptos, token: Buffer): Buffer {
    const cose = innerCose(decodeCbor(token));
    const { payload } = new CweKit({ kryptos, logger: this.logger }).decrypt(cose);
    return payload;
  }
}
