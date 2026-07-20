import { AesKit } from "@lindorm/aes";
import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { AegisError } from "../errors/index.js";
import { Tag } from "../internal/cose/cbor.js";
import {
  coseLabelToEnc,
  encToCoseLabel,
  isOfficialCoseEnc,
  tagBytesForEncryption,
} from "../internal/cose/enc-labels.js";
import {
  COSE_TAG,
  buildEncStructure,
  decodeProtectedHeader,
  encodeProtectedHeader,
} from "../internal/cose/structures.js";
import { coseByJose } from "../internal/header/header-registry.js";

export type CweKitSettings = {
  kryptos: IKryptos;
  logger: ILogger;
  /**
   * The content-encryption algorithm. Defaults to the key's own `encryption`;
   * supply it explicitly when the resolved key carries none (e.g. an Amphora
   * key), exactly as JweKit takes its encryption from Aegis.
   */
  encryption?: KryptosEncryption;
};

export type CweEncryptOptions = {
  typ?: string;
  /**
   * Allow a lindorm-proprietary (private-use) COSE encryption label (default
   * `false`). When `false` the content encryption MUST carry an OFFICIAL
   * COSE-RFC label or `encrypt` throws (D5 interop gate); when `true` a
   * private-use encryption such as AES-CBC-HMAC is permitted. Decrypt is always
   * lenient.
   */
  proprietary?: boolean;
};

export type CweDecryptResult = {
  payload: Buffer;
  protectedHeader: Map<number, unknown>;
};

const unwrapEncrypt0 = (value: unknown): Array<unknown> => {
  const contents =
    value instanceof Tag && value.tag === COSE_TAG.encrypt0 ? value.contents : value;
  if (!Array.isArray(contents) || contents.length !== 3) {
    throw new AegisError("Malformed COSE_Encrypt0", {
      code: "cose_malformed",
      title: "Malformed COSE_Encrypt0",
      details:
        "A COSE_Encrypt0 must be a 3-element array [protected, unprotected, ciphertext].",
    });
  }
  return contents;
};

/**
 * COSE_Encrypt0 (RFC 9052 §5.2) — direct symmetric AEAD, the COSE analogue of
 * JweKit. Reuses `AesKit.encryptContent`: the COSE `Enc_structure` is the AAD,
 * the IV travels unprotected (label 5), and the COSE ciphertext is `ct‖tag`.
 * AES-GCM and AES-CCM (the tag length comes from the algorithm).
 */
export class CweKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;
  private readonly encryption: KryptosEncryption | undefined;

  constructor(options: CweKitSettings) {
    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CweKit"]);
    this.encryption = options.encryption ?? options.kryptos.encryption ?? undefined;
  }

  encrypt(payload: Buffer, options: CweEncryptOptions = {}): Tag {
    this.logger.debug("Encrypting COSE_Encrypt0", { options });

    // Interop gate (D5): a non-proprietary encrypt refuses an encryption with no
    // OFFICIAL COSE-RFC registration (the AES-CBC-HMAC family) so the token stays
    // interoperable. A missing encryption still falls through to encToCoseLabel's
    // own throw below.
    if (!options.proprietary && this.encryption && !isOfficialCoseEnc(this.encryption)) {
      throw new AegisError(
        `Encryption "${this.encryption}" has no official COSE registration`,
        {
          code: "cose_enc_not_registered",
          data: { encryption: this.encryption },
          title: "COSE Encryption Not Registered",
          details:
            "In interoperable (non-proprietary) mode the content encryption must carry an official COSE-RFC label; the AES-CBC-HMAC family is private-use and requires proprietary mode.",
        },
      );
    }

    const protectedMap = new Map<number, unknown>();
    protectedMap.set(coseByJose("alg"), encToCoseLabel(this.encryption));
    if (options.typ !== undefined) protectedMap.set(coseByJose("typ"), options.typ);
    const protectedHeader = encodeProtectedHeader(protectedMap);

    const aad = buildEncStructure(protectedHeader);
    const { ciphertext, iv, tag } = new AesKit({
      kryptos: this.kryptos,
      encryption: this.encryption,
    }).encryptContent(payload, { aad });

    const unprotected = new Map<number, unknown>();
    unprotected.set(coseByJose("iv"), iv);
    unprotected.set(coseByJose("kid"), Buffer.from(this.kryptos.id, "utf8"));

    return new Tag(COSE_TAG.encrypt0, [
      protectedHeader,
      unprotected,
      Buffer.concat([ciphertext, tag]),
    ]);
  }

  decrypt(encrypt0: unknown): CweDecryptResult {
    const [protectedHeader, unprotected, coseCiphertext] = unwrapEncrypt0(encrypt0) as [
      Uint8Array,
      Map<number, unknown>,
      Uint8Array,
    ];

    const ivValue = unprotected.get(coseByJose("iv"));
    if (!(ivValue instanceof Uint8Array)) {
      throw new AegisError("COSE_Encrypt0 is missing its IV", {
        code: "cose_malformed",
        title: "Malformed COSE_Encrypt0",
        details: "The unprotected header has no IV (label 5).",
      });
    }

    // The content-encryption algorithm is self-describing — read it from the
    // protected header (label 1) rather than the key. It also fixes the tag
    // length (GCM/CCM-128 = 16 bytes, CCM-64 = 8).
    const decodedProtected = decodeProtectedHeader(protectedHeader);
    const encryption = coseLabelToEnc(decodedProtected.get(coseByJose("alg")) as number);

    // COSE ciphertext = ciphertext ‖ tag (the tag is the trailing bytes).
    const ct = Buffer.from(coseCiphertext);
    const tagBytes = tagBytesForEncryption(encryption);
    const ciphertext = ct.subarray(0, ct.length - tagBytes);
    const tag = ct.subarray(ct.length - tagBytes);

    const aad = buildEncStructure(Buffer.from(protectedHeader));
    const payload = new AesKit({ kryptos: this.kryptos, encryption }).decryptContent({
      aad,
      ciphertext,
      iv: Buffer.from(ivValue),
      tag,
    });

    return { payload, protectedHeader: decodedProtected };
  }
}
