import { AesKit } from "@lindorm/aes";
import { B64 } from "@lindorm/b64";
import {
  ECDH_ES_ALGORITHMS,
  type IKryptos,
  type KryptosEncAlgorithm,
  type KryptosEncryption,
} from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { sanitiseToken } from "@lindorm/utils";
import { JweError } from "../errors/index.js";
import type { IJweKit } from "../interfaces/index.js";
import { B64U } from "../internal/constants/format.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import { reconstructContent, serialiseContent } from "../internal/utils/content-codec.js";
import { decodeJoseHeader, encodeJoseHeader } from "../internal/utils/jose-header.js";
import { resolveCertBinding } from "../internal/utils/resolve-cert-binding.js";
import { parseTokenHeader } from "../internal/utils/token-header.js";
import { validateCrit } from "../internal/utils/validate-crit.js";
import { verifyCertBinding } from "../internal/utils/verify-cert-binding.js";
import { verifyPartyBinding } from "../internal/utils/verify-party-binding.js";
import { wireHeaderToDomainOptions } from "../internal/utils/wire-header-to-domain.js";
import type {
  CertificateBindingMode,
  DecodedEncryptedToken,
  DecryptedEncryptedToken,
  JweEncryptOptions,
  JweKitSettings,
  DomainTokenHeader,
  DomainTokenHeaderOptions,
  TokenContent,
  WireTokenHeader,
} from "../types/index.js";

/** The JWE wire segments decoded from a compact token (internal helper shape). */
type DecodedJweSegments = {
  header: WireTokenHeader;
  publicEncryptionKey: string | undefined;
  initialisationVector: string;
  content: string;
  authTag: string;
};

export class JweKit implements IJweKit {
  private readonly certBindingMode: CertificateBindingMode;
  private readonly encryption: KryptosEncryption;
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;
  private readonly partyRecipient: string | undefined;

  constructor(options: JweKitSettings) {
    this.logger = options.logger.child(["JweKit"]);
    this.kryptos = options.kryptos;
    this.encryption = options.encryption ?? options.kryptos.encryption ?? "A256GCM";
    this.certBindingMode = options.certBindingMode ?? "strict";
    this.partyRecipient = options.partyRecipient;
  }

  // RFC 7518 §4.6 — the apu/apv Concat-KDF OtherInfo is meaningful ONLY for the
  // ECDH-ES key-management family (direct + the `+A*KW` variants). Every other
  // algorithm ignores it, so caller-supplied party info is stripped there.
  private get isEcdhEs(): boolean {
    return (ECDH_ES_ALGORITHMS as ReadonlyArray<string>).includes(this.kryptos.algorithm);
  }

  /**
   * Encrypt the payload and return the BARE compact JWE token string — nothing
   * else. The `objectId`/format sugar is DOMAIN enrichment built Aegis-side.
   */
  encrypt(data: TokenContent, options: JweEncryptOptions = {}): string {
    const kit = new AesKit({ encryption: this.encryption, kryptos: this.kryptos });

    this.logger.debug("Encrypting token", { options });

    // Serialise to bytes via the shared codec and hand the OPAQUE bytes to the
    // AEAD (the AES layer treats them as octet). The cty defaults to the inferred
    // JS type; a caller `header.cty` (e.g. `JWT` for a nested token) wins. The cty
    // rides the AAD-protected protected header so decrypt round-trips the type.
    const { bytes, contentType } = serialiseContent(data, options.header?.cty);

    // ECDH-ES party info (RFC 7518 §4.6): gated on the algorithm. For an ECDH-ES
    // key the caller-supplied base64url apu/apv are decoded into the Concat-KDF
    // AND kept on the protected header (so they land in the AAD); for any other
    // algorithm they are stripped — neither fed to the KDF nor emitted.
    const partyProducer = this.isEcdhEs ? options.partyProducer : undefined;
    const partyRecipient = this.isEcdhEs ? options.partyRecipient : undefined;
    const apu = partyProducer ? B64.toBuffer(partyProducer, B64U) : undefined;
    const apv = partyRecipient ? B64.toBuffer(partyRecipient, B64U) : undefined;

    // Step 1: Prepare encryption (key management only — no content encrypted yet)
    const prepared = kit.prepareEncryption({ apu, apv });

    // Step 2: Build the protected header with key management output
    // RFC 7515 Section 4.1.11: crit MUST NOT include registered Header Parameter names.
    // All params used here (alg, enc, epk, iv, tag, p2c, p2s) are registered JOSE params.
    // Only genuinely non-standard extension params would go in critical.
    // Omit crit entirely when there are no extension params.
    const critical: Array<string> = [];

    const headerOptions: DomainTokenHeaderOptions = {
      // Default cty by inferred content type; a caller `header.cty` (folded in via
      // the spread) wins as the WIRE label.
      contentType,
      ...wireHeaderToDomainOptions(options.header),
      algorithm: this.kryptos.algorithm,
      ...(critical.length ? { critical } : {}),
      encryption: this.encryption,
      headerType: buildMediaType(options.tokenType, "jwe"),
      initialisationVector: prepared.headerParams.publicEncryptionIv,
      jwksUri: this.kryptos.jwksUri ?? undefined,
      keyId: this.kryptos.id,
      partyProducer,
      partyRecipient,
      pbkdfIterations: prepared.headerParams.pbkdfIterations,
      pbkdfSalt: prepared.headerParams.pbkdfSalt,
      publicEncryptionJwk: prepared.headerParams.publicEncryptionJwk,
      publicEncryptionTag: prepared.headerParams.publicEncryptionTag,
    };

    const cert = resolveCertBinding(
      this.kryptos,
      options.bindCertificate,
      options.certificateThumbprintSha1,
    );

    // Step 3: Encode header as base64url
    const header = encodeJoseHeader(headerOptions, cert);

    // Step 4: Compute AAD from the encoded protected header per RFC 7516 Section 5.1 step 14
    const aad = Buffer.from(header, "ascii");

    // Step 5: Encrypt the already-serialised OPAQUE bytes with AAD
    const { authTag, content, initialisationVector } = prepared.encrypt(bytes, { aad });

    if (!authTag) {
      throw new JweError("Missing auth tag", {
        code: "jwe_missing_auth_tag",
        title: "JWE Missing Auth Tag",
        details:
          "AES-GCM content encryption did not return an authentication tag, so the JWE cannot be assembled.",
      });
    }

    // Step 6: Assemble the JWE compact serialisation
    const token = [
      header,
      prepared.publicEncryptionKey ? B64.encode(prepared.publicEncryptionKey, B64U) : "",
      B64.encode(initialisationVector, B64U),
      B64.encode(content, B64U),
      B64.encode(authTag, B64U),
    ].join(".");

    this.logger.debug("Token encrypted", { token: sanitiseToken(token) });

    return token;
  }

  decrypt<T extends TokenContent = Buffer>(
    token: string,
  ): DecryptedEncryptedToken<T, string> {
    const kit = new AesKit({ encryption: this.encryption, kryptos: this.kryptos });

    this.logger.debug("Decrypting token", { token: sanitiseToken(token) });

    const decoded = JweKit.splitCompact(token);

    const typ = decoded.header.typ;
    if (typ !== "JWE" && !(typeof typ === "string" && typ.endsWith("+jwe"))) {
      throw new JweError("Invalid token", {
        code: "jwe_invalid_typ",
        data: { typ },
        title: "JWE Invalid Typ",
        details: "Header typ must be JWE or a <type>+jwe media type to decrypt as a JWE.",
      });
    }

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

    const critError = validateCrit(decoded.header);
    if (critError) {
      throw new JweError(`Invalid crit header: ${critError}`, {
        code: "jwe_invalid_crit",
        data: { crit: decoded.header.crit },
        title: "JWE Invalid Crit",
        details:
          "The crit header is malformed; it must be a non-empty array of strings naming extension parameters present in the header.",
      });
    }

    if (this.kryptos.algorithm !== decoded.header.alg) {
      throw new JweError("Invalid token", {
        code: "jwe_algorithm_mismatch",
        data: { alg: decoded.header.alg },
        debug: { expected: this.kryptos.algorithm },
        title: "JWE Algorithm Mismatch",
        details:
          "The header alg does not match the key-management algorithm of the configured kryptos key.",
      });
    }

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

    // RFC 7515 Section 4.1.11: reject any critical extension params we don't understand
    if (header.critical?.length) {
      for (const param of header.critical) {
        throw new JweError(`Unsupported critical header parameter: ${param}`, {
          code: "jwe_unsupported_crit_param",
          data: { param },
          title: "JWE Unsupported Crit Param",
          details:
            "The crit header marks an extension parameter as critical that Aegis does not understand, so the JWE must be rejected.",
        });
      }
    }

    // ECDH-ES party info (RFC 7518 §4.6): the recipient MUST re-derive with the
    // on-wire apu/apv or the Concat-KDF yields a different key and AEAD fails.
    // When this kit carries a partyRecipient identity, reject an ECDH-ES token
    // whose apv does not match up front — an actionable rejection instead of an
    // opaque GCM error (the apv is already AAD-bound, so this is defense-in-depth).
    // Recipient addressing is an ECDH-ES concept, so it is enforced only there —
    // a non-ECDH-ES algorithm has no apv channel to verify.
    if (this.isEcdhEs) {
      verifyPartyBinding({
        expected: this.partyRecipient,
        actual: header.partyRecipient,
      });
    }
    const apu = header.partyProducer
      ? B64.toBuffer(header.partyProducer, B64U)
      : undefined;
    const apv = header.partyRecipient
      ? B64.toBuffer(header.partyRecipient, B64U)
      : undefined;

    // Reconstruct AAD from the encoded protected header per RFC 7516 Section 5.1 step 14
    const [headerB64] = token.split(".");
    const aad = Buffer.from(headerB64, "ascii");

    const authTag = B64.toBuffer(decoded.authTag);
    const content = B64.toBuffer(decoded.content);
    const initialisationVector = B64.toBuffer(decoded.initialisationVector);
    const pbkdfIterations = header.pbkdfIterations;
    const pbkdfSalt = header.pbkdfSalt ? B64.toBuffer(header.pbkdfSalt, B64U) : undefined;
    const publicEncryptionIv = header.initialisationVector
      ? B64.toBuffer(header.initialisationVector)
      : undefined;
    const publicEncryptionKey = decoded.publicEncryptionKey
      ? B64.toBuffer(decoded.publicEncryptionKey)
      : undefined;
    const publicEncryptionJwk = header.publicEncryptionJwk;
    const publicEncryptionTag = header.publicEncryptionTag
      ? B64.toBuffer(header.publicEncryptionTag)
      : undefined;

    // Decrypt to the OPAQUE plaintext bytes (the AES layer treats the content as
    // octet); the JOSE cty — not the AES content type — drives reconstruction.
    const plaintext = kit.decrypt<Buffer>(
      {
        algorithm: header.algorithm as KryptosEncAlgorithm,
        apu,
        apv,
        authTag,
        content,
        contentType: "application/octet-stream",
        encryption: this.encryption,
        initialisationVector,
        keyId: header.keyId ?? this.kryptos.id,
        pbkdfIterations,
        pbkdfSalt,
        publicEncryptionIv,
        publicEncryptionJwk,
        publicEncryptionKey,
        publicEncryptionTag,
        version: "1.0",
      },
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
      },
      kryptos: this.kryptos,
      logger: this.logger,
      mode: this.certBindingMode,
    });

    this.logger.debug("Token decrypted");

    return { header: decoded.header, payload, token };
  }

  // public static

  static isJwe(jwe: string): boolean {
    if (typeof jwe !== "string") return false;
    const parts = jwe.split(".");
    if (parts.length !== 5) return false;
    try {
      const header = decodeJoseHeader(parts[0]);
      if (typeof header.alg !== "string") return false;
      const typ = header.typ;
      return typ === "JWE" || (typeof typ === "string" && typ.endsWith("+jwe"));
    } catch {
      return false;
    }
  }

  /**
   * WIRE decode (no decryption): the unified wire header ONLY — the single JOSE
   * protected header (compact JWE carries no per-recipient unprotected header,
   * so the merge is that one header). The content stays ciphertext; reading it
   * needs the key (that is `decrypt`). The uniform primitive shared with
   * `CweKit` decode.
   */
  static decode(token: string): DecodedEncryptedToken<string> {
    return { header: JweKit.splitCompact(token).header, token };
  }

  // private static

  /**
   * Split a compact JWE into its five wire segments (the internal shape `decrypt`
   * consumes). NOT public — the public keyless read is {@link JweKit.decode}.
   */
  private static splitCompact(jwe: string): DecodedJweSegments {
    const parts = jwe.split(".");
    if (parts.length !== 5) {
      throw new JweError("Invalid JWE format: expected 5 parts", {
        code: "jwe_invalid_format",
        title: "JWE Invalid Format",
        details:
          "A compact JWE must have exactly five dot-separated segments (header, encrypted key, iv, ciphertext, tag).",
      });
    }

    const [header, publicEncryptionKey, initialisationVector, content, authTag] = parts;

    return {
      header: decodeJoseHeader(header),
      publicEncryptionKey: publicEncryptionKey?.length ? publicEncryptionKey : undefined,
      initialisationVector,
      content,
      authTag,
    };
  }
}
