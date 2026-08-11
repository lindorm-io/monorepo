import { AesKit } from "@lindorm/aes";
import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CweError } from "../errors/index.js";
import type { ICweKit } from "../interfaces/index.js";
import { decodeCbor, encodeCbor, Tag } from "../internal/cose/cbor.js";
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
import { unwrapCose } from "../internal/cose/unwrap-cose.js";
import { buildCoseHeaders } from "../internal/header/build-cose-headers.js";
import { coseWireHeader } from "../internal/header/cose-wire-header.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { KIT_CAPABILITIES } from "../internal/registry/kit-capabilities.js";
import { reconstructContent, serialiseContent } from "../internal/utils/content-codec.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import { rejectUnknownCritical } from "../internal/utils/reject-unknown-critical.js";
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
   * The content-encryption AEAD for a key that DECLARES NONE — a fallback, not
   * an override. The key's own `encryption` wins; see `AesKitSettings`.
   */
  defaultEncryption?: KryptosEncryption;
};

/** The kit's own capability row — a COSE_Encrypt0 is `dir`-only and stamps four params. */
const CAPABILITIES = KIT_CAPABILITIES.cwe;

/**
 * COSE_Encrypt0 (RFC 9052 §5.2) — direct symmetric AEAD, the COSE analogue of
 * JweKit. Reuses `AesKit.encryptContent`: the COSE `Enc_structure` is the AAD,
 * the IV travels unprotected (label 5), and the COSE ciphertext is `ct‖tag`.
 * AES-GCM and AES-CCM (the tag length comes from the algorithm).
 */
export class CweKit implements ICweKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;
  private readonly encryption: KryptosEncryption;

  constructor(options: CweKitSettings) {
    // The capability gate, raised in the CONSTRUCTOR so it fires before any
    // content, header or AEAD work. COSE_Encrypt0 is DIRECT encryption — the
    // recipient key IS the content-encryption key — so the nineteen other JWE key
    // managements have no COSE_Encrypt0 form at all. Without this the key reached
    // `@lindorm/aes`, which refused it with its own "Content primitive requires a
    // direct key": a foreign error, several layers down, naming neither the wire
    // nor the reason the wire cannot carry the key.
    if (!CAPABILITIES.keyManagement.has(options.kryptos.algorithm)) {
      throw new CweError(
        `COSE_Encrypt0 cannot use key management "${options.kryptos.algorithm}"`,
        {
          code: "cose_key_management_unsupported",
          data: {
            algorithm: options.kryptos.algorithm,
            supported: [...CAPABILITIES.keyManagement],
          },
          title: "COSE Key Management Unsupported",
          details:
            "A COSE_Encrypt0 is direct encryption (RFC 9052 §5.2): the recipient key is the content-encryption key, so only a direct (dir) key can seal one. Encrypt to a dir key, or use the JOSE wire, whose JWE key-management algorithms have no COSE_Encrypt0 equivalent.",
        },
      );
    }

    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CweKit"]);
    // Same floor as JweKit and AesKit — all three wire kits resolve
    // key-first, then the deployment fallback, then `A256GCM`.
    this.encryption =
      options.kryptos.encryption ?? options.defaultEncryption ?? "A256GCM";

    // No `contentEncryption` gate here: the row is the WHOLE kryptos encryption
    // set, and `KryptosEncryption` IS that set, so a gate on it could never fire.
    // Where the row can bite is the READ side, on a value that arrives as an
    // arbitrary wire string — which is `decodeJoseHeader`'s `enc` allowlist for
    // the JOSE twin, and `coseLabelToEnc` (a total label table) here.
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
    // interoperable.
    if (!options.proprietary && !isOfficialCoseEnc(this.encryption)) {
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

    // The content encryption sits on label 1 (the COSE_Encrypt0 analogue of `alg`),
    // `typ` (label 16) is the kit-computed media type from the `tokenType` PREFIX
    // and `cty` (label 3) the inferred content type; `kid` (derived) and `iv`
    // (computed) travel unprotected. `alg`/`kid`/`iv`/`typ` are the RESERVED set a
    // caller cannot supply — `typ` among them because it is what routes the token.
    // `cty` stays settable, and `serialiseContent` has already honoured it above.
    const protectedMap = new Map<number, unknown>();
    protectedMap.set(coseByJose("alg"), encToCoseLabel(this.encryption));
    protectedMap.set(coseByJose("typ"), buildMediaType(options.tokenType, "cwe"));
    protectedMap.set(coseByJose("cty"), contentType);

    const { protectedEntries, unprotectedEntries } = buildCoseHeaders({
      reserved: CAPABILITIES.reserved,
      header: options.header as Partial<WireTokenHeader> | undefined,
      unprotected: options.unprotected,
      error: CweError,
    });

    for (const [label, value] of protectedEntries) protectedMap.set(label, value);
    // The protected header must be finalized BEFORE the AEAD runs — it is the AAD.
    const protectedHeader = encodeProtectedHeader(protectedMap);

    const aad = buildEncStructure(protectedHeader);
    const { ciphertext, iv, tag } = new AesKit({
      kryptos: this.kryptos,
      defaultEncryption: this.encryption,
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
    // JweKit.decrypt). The outer CWT tag (61) is stripped by `unwrapCose`.
    const contents = unwrapCose(decodeCbor(token), {
      arity: { exactly: 3 },
      tags: [COSE_TAG.encrypt0],
    });

    if (!contents) {
      throw new CweError("Malformed COSE_Encrypt0", {
        code: "cose_malformed",
        title: "Malformed COSE_Encrypt0",
        details:
          "A COSE_Encrypt0 must be a 3-element array [protected, unprotected, ciphertext].",
      });
    }

    const [protectedBstr, unprotected, coseCiphertext] = contents as [
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
    const decodedProtected = decodeProtectedHeader(protectedBstr);
    const encryption = coseLabelToEnc(decodedProtected.get(coseByJose("alg")) as number);

    const protectedHeader = coseWireHeader(decodedProtected, "enc");

    // `crit` (RFC 9052 §3.1) off the PROTECTED bucket — which for a COSE_Encrypt0
    // is the AAD, so it is the one bucket the AEAD covers. Enforced BEFORE the
    // decryption, exactly as JweKit does.
    rejectUnknownCritical({ header: protectedHeader, format: "cwe", error: CweError });

    // COSE ciphertext = ciphertext ‖ tag (the tag is the trailing bytes).
    const ct = Buffer.from(coseCiphertext);
    const tagBytes = tagBytesForEncryption(encryption);
    const ciphertext = ct.subarray(0, ct.length - tagBytes);
    const tag = ct.subarray(ct.length - tagBytes);

    const aad = buildEncStructure(Buffer.from(protectedBstr));
    // The label off the protected header is the authority here — it names what
    // the sender used, which may not be what this key declares.
    const plaintext = new AesKit({ kryptos: this.kryptos }).decryptContent({
      encryption,
      aad,
      ciphertext,
      iv: Buffer.from(ivValue),
      tag,
    });

    // Reconstruct by the PROTECTED cty: the AEAD (whose AAD covers the protected
    // header, cty included) has already been verified above. Absent/unknown cty
    // falls back to Buffer.
    return {
      protectedHeader,
      unprotectedHeader: coseWireHeader(unprotected, "enc"),
      payload: reconstructContent<T>(plaintext, protectedHeader.cty),
      token,
    };
  }

  /**
   * WIRE decode (no decryption): decode the CBOR-encoded COSE_Encrypt0 (tag 16,
   * tagged or bare) and translate its protected + unprotected header maps into the
   * two {@link DecodedEncryptedToken} WIRE header buckets (integer labels
   * translated to their JOSE wire names — the content-encryption label lands on
   * `enc`). The ciphertext stays encrypted; reading it needs the key (that is
   * `decrypt`). The uniform primitive shared with `JweKit` decode.
   */
  static decode(token: Buffer): DecodedEncryptedToken<Buffer> {
    // The outer CWT tag (61) is stripped — symmetric with `decrypt`, which strips
    // it too. A bare, un-enveloped token passes through unchanged.
    const contents = unwrapCose(decodeCbor(token), {
      arity: { exactly: 3 },
      tags: [COSE_TAG.encrypt0],
    });

    if (!contents) {
      throw new CweError("Malformed COSE_Encrypt0", {
        code: "cose_malformed",
        title: "Malformed COSE_Encrypt0",
        details:
          "A COSE_Encrypt0 must be a 3-element array [protected, unprotected, ciphertext].",
      });
    }

    const [protectedBstr, unprotected] = contents as [
      Uint8Array,
      Map<number, unknown> | undefined,
    ];

    return {
      protectedHeader: coseWireHeader(decodeProtectedHeader(protectedBstr), "enc"),
      unprotectedHeader: coseWireHeader(
        unprotected instanceof Map ? unprotected : undefined,
        "enc",
      ),
      token,
    };
  }
}
