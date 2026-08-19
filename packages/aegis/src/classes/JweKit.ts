import { AesKit } from "@lindorm/aes";
import { isJwe as isJweFormat } from "@lindorm/is";
import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { sanitiseToken } from "@lindorm/utils";
import { JweError } from "../errors/index.js";
import type { IJweKit } from "../interfaces/index.js";
import { buildJoseHeader } from "../internal/header/build-jose-header.js";
import { normaliseHeaders } from "../internal/header/normalise-headers.js";
import { KIT_CAPABILITIES } from "../internal/registry/kit-capabilities.js";
import { assertWireTyp } from "../internal/utils/assert-wire-typ.js";
import { buildJweDecryptionRecord } from "../internal/utils/build-jwe-decryption-record.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import { reconstructContent, serialiseContent } from "../internal/utils/content-codec.js";
import { isSupportedJoseAlgorithm } from "../internal/utils/is-supported-jose-algorithm.js";
import { encodeJoseHeader } from "../internal/utils/jose-header.js";
import { assembleJweCompact } from "../internal/utils/assemble-jwe-compact.js";
import { isEcdhEsAlgorithm } from "../internal/utils/is-ecdh-es-algorithm.js";
import { JOSE_THUMBPRINT_SHA1 } from "../internal/utils/jose-thumbprint-sha1.js";
import { resolveCertBinding } from "../internal/utils/resolve-cert-binding.js";
import { resolveContentEncryption } from "../internal/utils/resolve-content-encryption.js";
import { resolveEcdhParty } from "../internal/utils/resolve-ecdh-party.js";
import { splitJweCompact } from "../internal/utils/split-jwe-compact.js";
import { assertProtectedHeaderGates } from "../internal/utils/assert-protected-header-gates.js";
import { parseTokenHeader } from "../internal/utils/token-header.js";
import { verifyCertBinding } from "../internal/utils/verify-cert-binding.js";
import { verifyPartyBinding } from "../internal/utils/verify-party-binding.js";
import type {
  CertificateBindingMode,
  DecodedEncryptedToken,
  DecryptedEncryptedToken,
  JweEncryptOptions,
  JweKitSettings,
  DomainTokenHeader,
  TokenContent,
} from "../types/index.js";

export class JweKit implements IJweKit {
  private readonly certBindingMode: CertificateBindingMode;
  private readonly encryption: KryptosEncryption;
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;
  private readonly partyRecipient: string | undefined;

  constructor(options: JweKitSettings) {
    this.logger = options.logger.child(["JweKit"]);
    this.kryptos = options.kryptos;
    this.encryption = resolveContentEncryption(
      options.kryptos,
      options.defaultEncryption,
    );
    this.certBindingMode = options.certBindingMode ?? "strict";
    this.partyRecipient = options.partyRecipient;
  }

  /**
   * Encrypt the payload and return the BARE compact JWE token string — nothing
   * else. The `objectId`/format sugar is DOMAIN enrichment built Aegis-side.
   */
  encrypt(data: TokenContent, options: JweEncryptOptions = {}): string {
    const kit = new AesKit({
      defaultEncryption: this.encryption,
      kryptos: this.kryptos,
    });

    this.logger.debug("Encrypting token", { options });

    // A parameter that emits nothing is not a parameter, and the caller's bag is
    // normalised HERE because the next line READS it — a builder normalisation is
    // too late. An empty `cty` would be preferred over the inferred type and the
    // payload would come back a Buffer (`normalise-headers.ts`).
    const callerHeader = normaliseHeaders(options.header ?? {});

    // Serialise to bytes via the shared codec and hand the OPAQUE bytes to the
    // AEAD (the AES layer treats them as octet). The cty defaults to the inferred
    // JS type; a caller `header.cty` (e.g. `JWT` for a nested token) wins. The cty
    // rides the AAD-protected protected header so decrypt round-trips the type.
    const { bytes, contentType } = serialiseContent(data, callerHeader.cty);

    // ECDH-ES party info (RFC 7518 §4.6): gated on the algorithm. For an ECDH-ES
    // key the caller-supplied base64url apu/apv are decoded into the Concat-KDF
    // AND kept on the protected header (so they land in the AAD); for any other
    // algorithm they are stripped — neither fed to the KDF nor emitted.
    const { apu, apv, partyProducer, partyRecipient } = resolveEcdhParty(
      this.kryptos.algorithm,
      options,
    );

    // Step 1: Prepare encryption (key management only — no content encrypted yet)
    const prepared = kit.prepareEncryption({ apu, apv });

    // Step 2: Build the protected header with key management output.
    //
    // No `crit` is ever written: RFC 7515 §4.1.11 forbids `crit` from naming
    // registered parameters, and every parameter the kit derives here (alg, enc,
    // epk, iv, tag, p2c, p2s) is registered. Aegis implements no extension
    // parameter, so the header carries no `crit` of its own at all.
    const header = encodeJoseHeader(
      buildJoseHeader({
        reserved: KIT_CAPABILITIES.jwe.reserved,
        defaults: { cty: contentType, jku: this.kryptos.jwksUri ?? undefined },
        header: callerHeader,
        derived: {
          alg: this.kryptos.algorithm,
          apu: partyProducer,
          apv: partyRecipient,
          enc: this.encryption,
          epk: prepared.headerParams.publicEncryptionJwk,
          iv: prepared.headerParams.publicEncryptionIv,
          kid: this.kryptos.id,
          p2c: prepared.headerParams.pbkdfIterations,
          p2s: prepared.headerParams.pbkdfSalt,
          tag: prepared.headerParams.publicEncryptionTag,
          typ: buildMediaType(options.tokenType, "jwe"),
        },
        cert: resolveCertBinding(
          this.kryptos,
          options.bindCertificate,
          JOSE_THUMBPRINT_SHA1,
        ),
        format: "jwe",
        error: JweError,
      }),
    );

    // Step 3: Compute AAD from the encoded protected header per RFC 7516 Section 5.1 step 14
    const aad = Buffer.from(header, "ascii");

    // Step 4: Encrypt the already-serialised OPAQUE bytes with AAD
    const { authTag, content, initialisationVector } = prepared.encrypt(bytes, { aad });

    if (!authTag) {
      throw new JweError("Missing auth tag", {
        code: "jwe_missing_auth_tag",
        title: "JWE Missing Auth Tag",
        details:
          "AES-GCM content encryption did not return an authentication tag, so the JWE cannot be assembled.",
      });
    }

    // Step 5: Assemble the JWE compact serialisation
    const token = assembleJweCompact({
      header,
      publicEncryptionKey: prepared.publicEncryptionKey,
      initialisationVector,
      content,
      authTag,
    });

    this.logger.debug("Token encrypted", { token: sanitiseToken(token) });

    return token;
  }

  decrypt<T extends TokenContent = Buffer>(
    token: string,
  ): DecryptedEncryptedToken<T, string> {
    // Decrypt is driven by the DECRYPTION RECORD assembled below — the wire's
    // own `enc` — so the kit needs no encryption of its own.
    const kit = new AesKit({ kryptos: this.kryptos });

    this.logger.debug("Decrypting token", { token: sanitiseToken(token) });

    const decoded = splitJweCompact(token);

    // ⚠ `presence: "required"` — unlike the JWT/JWS/CWT gates, a typ-LESS JWE has
    // always been refused here.
    assertWireTyp({
      typ: decoded.header.typ,
      accept: ["JWE"],
      suffix: "+jwe",
      presence: "required",
      error: JweError,
      code: "jwe_invalid_typ",
      title: "JWE Invalid Typ",
      details: "Header typ must be JWE or a <type>+jwe media type to decrypt as a JWE.",
    });

    // Aegis deliberately does not support compressed payloads (RFC 7516 §4.1.3).
    // Compression-before-encryption enables oracle attacks (CVE-2016-1000031 class).
    // Explicit rejection is safer than silent passthrough.
    if ((decoded.header as { zip?: unknown }).zip !== undefined) {
      throw new JweError("Compressed JWE payloads are not supported", {
        code: "jwe_compression_unsupported",
        data: { zip: (decoded.header as { zip?: unknown }).zip },
        title: "JWE Compression Unsupported",
        details:
          "The header carries a zip parameter, but Aegis rejects compressed JWE payloads to avoid compression-oracle attacks.",
      });
    }

    // `crit` (RFC 7515 §4.1.11) then algorithm-match — the ONE pair, in the ONE
    // order, that every wire runs ahead of its signature or AEAD cycle. The crit
    // check used to be split in two HERE — malformed BEFORE the algorithm-match,
    // unrecognised AFTER the encryption-match — so a JWE marking an unrecognised
    // extension critical was answered by whichever of the three ran first.
    assertProtectedHeaderGates({
      protectedHeader: decoded.header,
      expectedAlgorithm: this.kryptos.algorithm,
      format: "jwe",
      error: JweError,
      algDetails:
        "The header alg does not match the key-management algorithm of the configured kryptos key.",
      // ⚠ This wire reports the offending value under `alg`, not `algorithm`.
      algData: { alg: decoded.header.alg },
    });

    // Parse to the DOMAIN header for the decryption crypto (algorithm, enc,
    // party info, pbkdf/public-encryption params); the RESULT carries the WIRE
    // header (R1), so `decoded.header` is what is returned.
    const header: DomainTokenHeader = parseTokenHeader(decoded.header);

    if (header.encryption !== this.encryption) {
      throw new JweError("Unexpected encryption", {
        code: "jwe_encryption_mismatch",
        debug: { actual: header.encryption, encryption: this.encryption },
        title: "JWE Encryption Mismatch",
        details:
          "The header enc does not match the content-encryption algorithm this kit is configured to accept.",
      });
    }

    // ECDH-ES party info (RFC 7518 §4.6): the recipient MUST re-derive with the
    // on-wire apu/apv or the Concat-KDF yields a different key and AEAD fails.
    // When this kit carries a partyRecipient identity, reject an ECDH-ES token
    // whose apv does not match up front — an actionable rejection instead of an
    // opaque GCM error (the apv is already AAD-bound, so this is defense-in-depth).
    // Recipient addressing is an ECDH-ES concept, so it is enforced only there —
    // a non-ECDH-ES algorithm has no apv channel to verify.
    if (isEcdhEsAlgorithm(this.kryptos.algorithm)) {
      verifyPartyBinding({
        expected: this.partyRecipient,
        actual: header.partyRecipient,
      });
    }

    const { apu, apv } = resolveEcdhParty(this.kryptos.algorithm, header);

    // Reconstruct AAD from the encoded protected header per RFC 7516 Section 5.1 step 14
    const [headerB64] = token.split(".");
    const aad = Buffer.from(headerB64, "ascii");

    // Decrypt to the OPAQUE plaintext bytes (the AES layer treats the content as
    // octet); the JOSE cty — not the AES content type — drives reconstruction.
    const plaintext = kit.decrypt<Buffer>(
      buildJweDecryptionRecord({
        segments: decoded,
        header,
        encryption: this.encryption,
        apu,
        apv,
        keyId: this.kryptos.id,
      }),
      { aad },
    );

    // Reconstruct-by-cty is SAFE: AES-GCM authenticated decryption (the AAD covers
    // the header carrying the cty) has already succeeded above. Absent/unknown cty
    // falls back to the raw Buffer.
    const payload = reconstructContent<T>(plaintext, decoded.header.cty);

    // Content tamper check: runs AFTER decryption has succeeded (AES-GCM
    // authenticated decryption validates AAD over the header). NOT a key
    // selection step — header cert fields remain forbidden as key sources.
    // See the SECURITY INVARIANT in Aegis.kryptosSig.
    verifyCertBinding({
      header: {
        certificateThumbprint: header.certificateThumbprint,
        certificateThumbprintSha1: header.certificateThumbprintSha1,
      },
      kryptos: this.kryptos,
      logger: this.logger,
      mode: this.certBindingMode,
    });

    this.logger.debug("Token decrypted");

    return {
      protectedHeader: decoded.header,
      // Compact JOSE serialisation has ONE header and it is protected — a compact
      // JWE carries no per-recipient unprotected header
      // (`KIT_CAPABILITIES.jwe.unprotectedBucket`).
      unprotectedHeader: {},
      payload,
      token,
    };
  }

  // public static

  /**
   * Is this the JWE Compact Serialization (RFC 7516 §7.1), encrypted with an
   * algorithm on the allowlist? Five segments and the two REQUIRED header
   * parameters, `alg` (§4.1.1) and `enc` (§4.1.2) — never a `typ`, which RFC
   * 7516 does not require at all, so an externally issued encrypted token
   * carries none and used to be rejected as an unrecognised wire.
   */
  static isJwe(jwe: string): boolean {
    return isJweFormat(jwe) && isSupportedJoseAlgorithm(jwe);
  }

  /**
   * WIRE decode (no decryption): the unified wire header ONLY — the single JOSE
   * protected header (compact JWE carries no per-recipient unprotected header,
   * so the merge is that one header). The content stays ciphertext; reading it
   * needs the key (that is `decrypt`). The uniform primitive shared with
   * `CweKit` decode.
   */
  static decode(token: string): DecodedEncryptedToken<string> {
    return {
      protectedHeader: splitJweCompact(token).header,
      unprotectedHeader: {},
      token,
    };
  }
}
