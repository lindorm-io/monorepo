import { AesKit } from "@lindorm/aes";
import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CweError } from "../errors/index.js";
import type { ICweKit } from "../interfaces/index.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
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
import { buildCoseHeaders } from "../internal/header/build-cose-headers.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { mergeCoseWireHeader } from "../internal/header/merge-cose-wire-header.js";
import { reconstructContent, serialiseContent } from "../internal/utils/content-codec.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import type {
  CweEncryptOptions,
  DecodedEncryptedToken,
  DecryptedEncryptedToken,
  TokenContent,
  WireTokenHeader,
} from "../types/index.js";

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

const unwrapEncrypt0 = (value: unknown): Array<unknown> => {
  const contents =
    value instanceof Tag && value.tag === COSE_TAG.encrypt0 ? value.contents : value;
  if (!Array.isArray(contents) || contents.length !== 3) {
    throw new CweError("Malformed COSE_Encrypt0", {
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
export class CweKit implements ICweKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;
  private readonly encryption: KryptosEncryption | undefined;

  constructor(options: CweKitSettings) {
    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CweKit"]);
    this.encryption = options.encryption ?? options.kryptos.encryption ?? undefined;
  }

  /**
   * Encrypt the content and return the BARE encoded COSE token — the CBOR-encoded
   * COSE_Encrypt0 bytes, nothing else. Any content is faithful: the cty is
   * inferred (Dict→json, string→text, Buffer→octet), the bytes are serialised via
   * the shared codec, and the cty (label 3) rides the AAD-protected protected
   * header so decrypt round-trips the JS type. The outer CWT tag (61) framing is a
   * concern of the layer above.
   */
  encrypt(content: TokenContent, options: CweEncryptOptions = {}): Buffer {
    this.logger.debug("Encrypting COSE_Encrypt0", { options });

    // Serialise the content to OPAQUE bytes; the AES layer AEADs them as octet.
    // The cty defaults to the inferred type; a caller `header.cty` (e.g.
    // `application/cwt` for a nested token) wins as the WIRE label.
    const { bytes, contentType } = serialiseContent(content, options.header?.cty);

    // Interop gate (D5): a non-proprietary encrypt refuses an encryption with no
    // OFFICIAL COSE-RFC registration (the AES-CBC-HMAC family) so the token stays
    // interoperable. A missing encryption still falls through to encToCoseLabel's
    // own throw below.
    if (!options.proprietary && this.encryption && !isOfficialCoseEnc(this.encryption)) {
      throw new CweError(
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

    // The content encryption sits on label 1 (the COSE_Encrypt0 analogue of `alg`);
    // `kid` (derived) and `iv` (computed) travel unprotected. Those three are the
    // reserved set the caller cannot supply. `typ` (label 16) is the kit-computed
    // media type from the `tokenType` PREFIX (not settable via the header bag).
    // `cty` (label 3) defaults to the inferred content type and lands PROTECTED; a
    // caller `header.cty` wins.
    const header: Partial<WireTokenHeader> = {
      typ: buildMediaType(options.tokenType, "cwe"),
      cty: contentType,
      ...options.header,
    };
    const { protectedEntries, unprotectedEntries } = buildCoseHeaders({
      reserved: new Set([coseByJose("alg"), coseByJose("kid"), coseByJose("iv")]),
      header,
      unprotected: options.unprotected,
      error: CweError,
    });

    const protectedMap = new Map<number, unknown>();
    protectedMap.set(coseByJose("alg"), encToCoseLabel(this.encryption));
    for (const [label, value] of protectedEntries) protectedMap.set(label, value);
    // The protected header must be finalized BEFORE the AEAD runs — it is the AAD.
    const protectedHeader = encodeProtectedHeader(protectedMap);

    const aad = buildEncStructure(protectedHeader);
    const { ciphertext, iv, tag } = new AesKit({
      kryptos: this.kryptos,
      encryption: this.encryption,
    }).encryptContent(bytes, { aad });

    const unprotected = new Map<number, unknown>();
    unprotected.set(coseByJose("iv"), iv);
    unprotected.set(coseByJose("kid"), Buffer.from(this.kryptos.id, "utf8"));
    for (const [label, value] of unprotectedEntries) unprotected.set(label, value);

    return encodeCbor(
      new Tag(COSE_TAG.encrypt0, [
        protectedHeader,
        unprotected,
        Buffer.concat([ciphertext, tag]),
      ]),
    );
  }

  decrypt<T extends TokenContent = Buffer>(
    token: Buffer,
  ): DecryptedEncryptedToken<T, Buffer> {
    // R2: the kit takes the ENCODED bytes and decodes internally (parallel to
    // JweKit.decrypt). Strip an optional outer CWT tag (61) to reach the
    // COSE_Encrypt0.
    const decoded = decodeCbor(token);
    const cose =
      decoded instanceof Tag && decoded.tag === COSE_TAG.cwt ? decoded.contents : decoded;

    const [protectedHeader, unprotected, coseCiphertext] = unwrapEncrypt0(cose) as [
      Uint8Array,
      Map<number, unknown>,
      Uint8Array,
    ];

    const ivValue = unprotected.get(coseByJose("iv"));
    if (!(ivValue instanceof Uint8Array)) {
      throw new CweError("COSE_Encrypt0 is missing its IV", {
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
    const plaintext = new AesKit({ kryptos: this.kryptos, encryption }).decryptContent({
      aad,
      ciphertext,
      iv: Buffer.from(ivValue),
      tag,
    });

    const header = mergeCoseWireHeader(decodedProtected, unprotected, "enc");

    // Reconstruct-by-cty is SAFE: the AEAD (AAD covers the protected header + cty)
    // has already been verified above. Absent/unknown cty falls back to Buffer.
    return {
      header,
      payload: reconstructContent<T>(plaintext, header.cty),
      token,
    };
  }

  /**
   * WIRE decode (no decryption): decode the CBOR-encoded COSE_Encrypt0 (tag 16,
   * tagged or bare), merge its protected + unprotected header maps into ONE
   * {@link DecodedEncryptedToken} wire header (integer labels translated to
   * their JOSE wire names — the content-encryption label lands on `enc`). The
   * ciphertext stays encrypted; reading it needs the key (that is `decrypt`).
   * The uniform primitive shared with `JweKit` decode.
   */
  decode(token: Buffer): DecodedEncryptedToken<Buffer> {
    const [protectedBstr, unprotected] = unwrapEncrypt0(decodeCbor(token)) as [
      Uint8Array,
      Map<number, unknown> | undefined,
      Uint8Array,
    ];

    return {
      header: mergeCoseWireHeader(
        decodeProtectedHeader(protectedBstr),
        unprotected instanceof Map ? unprotected : undefined,
        "enc",
      ),
      token,
    };
  }
}
