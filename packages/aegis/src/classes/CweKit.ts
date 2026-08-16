import { AesKit } from "@lindorm/aes";
import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CweError } from "../errors/index.js";
import type { ICweKit } from "../interfaces/index.js";
import { encodeCbor, Tag } from "../internal/cose/cbor.js";
import type { CoseLabel } from "../internal/cose/cose-label.js";
import { assertCoseRegistered } from "../internal/cose/assert-cose-registered.js";
import {
  coseLabelToEnc,
  encToCoseLabel,
  tagBytesForEncryption,
} from "../internal/cose/enc-labels.js";
import {
  COSE_TAG,
  buildEncStructure,
  decodeProtectedHeader,
} from "../internal/cose/structures.js";
import { splitEncrypt0 } from "../internal/cose/split-encrypt0.js";
import { buildCoseHeaders } from "../internal/header/build-cose-headers.js";
import { coseWireHeader } from "../internal/header/cose-wire-header.js";
import { mergeCoseProtected } from "../internal/header/merge-cose-protected.js";
import { mergeCoseUnprotected } from "../internal/header/merge-cose-unprotected.js";
import { normaliseHeaders } from "../internal/header/normalise-headers.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { KIT_CAPABILITIES } from "../internal/registry/kit-capabilities.js";
import { reconstructContent, serialiseContent } from "../internal/utils/content-codec.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import { rejectUnknownCritical } from "../internal/utils/reject-unknown-critical.js";
import { resolveContentEncryption } from "../internal/utils/resolve-content-encryption.js";
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
 *
 * ONE PLAINTEXT DOOR. Whatever it is handed is serialised by the shared content
 * codec under its own keys and comes back as the same value — a Dict declares
 * `application/json` exactly as the three other opaque doors do (`JwsKit`,
 * `JweKit`, `CwsKit`), so a Dict is a Dict in and a Dict out on every wire.
 *
 * ⚠ There was briefly a SECOND door (`encryptClaims`/`decryptClaims`) that wrote
 * a CWT Claims Set under RFC 8392's registered INTEGER LABELS, for a domain
 * encrypt path that translated claims on the way in. That path is gone —
 * `aegis.encrypt` is pure confidentiality and seals the caller's value verbatim —
 * so the second door had no caller and a COSE_Encrypt0 written by aegis never
 * carries label-mapped claims. Signing a CWT Claims Set is still `CwtKit`/
 * `CwmKit`, which is where the RFC 8392 Message belongs.
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
    this.encryption = resolveContentEncryption(
      options.kryptos,
      options.defaultEncryption,
    );

    // No `contentEncryption` gate here: the row is the WHOLE kryptos encryption
    // set, and `KryptosEncryption` IS that set, so a gate on it could never fire.
    // Where the row can bite is the READ side, on a value that arrives as an
    // arbitrary wire string — which is `decodeJoseHeader`'s `enc` allowlist for
    // the JOSE twin, and `coseLabelToEnc` (a total label table) here.
  }

  /**
   * Encrypt content and return the BARE encoded COSE token — the CBOR-encoded
   * COSE_Encrypt0 bytes, nothing else. Any content is faithful: the cty is
   * inferred (Dict→json, string→text, Buffer→octet), the bytes are serialised via
   * the shared codec, and the cty (label 3) rides the AAD-protected protected
   * header so decrypt round-trips the JS type. The outer CWT tag (61) framing is
   * a concern of the layer above.
   *
   * ⚠ A `Dict` here is OPAQUE STRUCTURE, never a claims set: it is serialised
   * under its own literal keys, so `{ iss: "x" }` writes the key `"iss"` and never
   * the CWT integer label 1. Promoting an arbitrary object's keys to registered
   * claims would make a foreign reader trust an issuer its author never asserted.
   */
  encrypt(content: TokenContent, options: CweEncryptOptions = {}): Buffer {
    this.logger.debug("Encrypting COSE_Encrypt0", { options });

    // A parameter that emits nothing is not a parameter, and the caller's bag is
    // normalised HERE because the line below READS it — a builder normalisation is
    // too late. An empty `cty` would be preferred over the inferred type and the
    // payload would come back a Buffer; it would also reach label 3 as `[3, ""]`,
    // where the JOSE twin drops it, and the two wires would disagree about the
    // same call (`normalise-headers.ts`).
    const callerHeader = normaliseHeaders(options.header ?? {});

    // Serialise the content to bytes; the AES layer AEADs them as octet. The cty
    // defaults to the inferred type; a caller `header.cty` (e.g.
    // `application/cwt` for a nested token) wins as the WIRE label.
    //
    // The `json` FAMILY, which is the one thing this door does not decide for
    // itself: `JwsKit`, `JweKit` and `CwsKit` all serialise a structured value as
    // JSON, so a Dict answers `application/json` on every wire and reconstructs
    // as a Dict — the `@lindorm/aes` contract.
    const { bytes, contentType } = serialiseContent(content, callerHeader.cty);

    // Interop gate (D5): a non-proprietary encrypt refuses an encryption with no
    // OFFICIAL COSE-RFC registration (the AES-CBC-HMAC family) so the token stays
    // interoperable.
    assertCoseRegistered({
      kind: "enc",
      value: this.encryption,
      proprietary: options.proprietary,
      error: CweError,
    });

    // The content encryption sits on label 1 (the COSE_Encrypt0 analogue of `alg`),
    // `typ` (label 16) is the kit-computed media type from the `tokenType` PREFIX
    // and `cty` (label 3) the inferred content type; `kid` (derived) and `iv`
    // (computed) travel unprotected. `alg`/`kid`/`iv`/`typ` are the RESERVED set a
    // caller cannot supply — `typ` among them because it is what routes the token.
    // `cty` stays settable, and the codec above has already honoured a caller's
    // value when resolving `contentType`, so this writes what it resolved.
    //
    // ⚠ `proprietary` also decides the SPELLING of a private-use label — it is
    // the same interop promise the encryption gate above enforces, applied to the
    // header: the default writes a caller's `oid` under its string label rather
    // than the lindorm integer no foreign reader can interpret.
    const { protectedEntries, unprotectedEntries } = buildCoseHeaders({
      reserved: CAPABILITIES.reserved,
      header: callerHeader as Partial<WireTokenHeader>,
      unprotected: options.unprotected,
      proprietary: options.proprietary,
      error: CweError,
    });

    // The protected header must be finalized BEFORE the AEAD runs — it is the AAD.
    // That is also the point the bucket is COMPLETE, so the `crit` satisfaction
    // check runs inside this call, before a byte is encrypted under a header the
    // caller's own `crit` contradicts.
    const protectedHeader = mergeCoseProtected({
      alg: encToCoseLabel(this.encryption),
      typ: buildMediaType(options.tokenType, "cwe"),
      cty: contentType,
      entries: protectedEntries,
      proprietary: options.proprietary,
      format: "cwe",
      error: CweError,
    });

    const aad = buildEncStructure(protectedHeader);
    const { ciphertext, iv, tag } = new AesKit({
      kryptos: this.kryptos,
      defaultEncryption: this.encryption,
    }).encryptContent(bytes, { aad });

    // The IV only exists once the AEAD has run, which is why the unprotected
    // bucket is written here rather than beside the protected one.
    const unprotected = mergeCoseUnprotected({
      kid: this.kryptos.id,
      iv,
      entries: unprotectedEntries,
      proprietary: options.proprietary,
    });

    return encodeCbor(
      new Tag(COSE_TAG.encrypt0, [
        protectedHeader,
        unprotected,
        Buffer.concat([ciphertext, tag]),
      ]),
    );
  }

  /**
   * Decrypt to the content the cty declares — the read twin of {@link encrypt}.
   * An `application/json` plaintext reconstructs to the structure it was written
   * from, under its own literal keys.
   */
  decrypt<T extends TokenContent = Buffer>(
    token: Buffer,
  ): DecryptedEncryptedToken<T, Buffer> {
    // R2: the kit takes the ENCODED bytes and decodes internally (parallel to
    // JweKit.decrypt). The outer CWT tag (61) is stripped by `splitEncrypt0`.
    const segments = splitEncrypt0(token);
    const { protectedBstr, coseCiphertext } = segments;
    const unprotected = segments.unprotected as Map<CoseLabel, unknown>;

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
    // header, cty included) has already been verified. Absent/unknown cty falls
    // back to Buffer.
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
    const { protectedBstr, unprotected } = splitEncrypt0(token);

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
