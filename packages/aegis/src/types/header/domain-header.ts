import type { PublicEncryptionJwk } from "@lindorm/aes";
import type { KryptosEncryption, KryptosJwk } from "@lindorm/kryptos";
import type {
  BaseTokenFormat,
  TokenHeaderAlgorithm,
  TokenHeaderType,
} from "./wire-header.js";

// --- DOMAIN (aegis-named) — ONE canonical type; the rest derive from it ------

/**
 * THE domain type: the parsed header in aegis domain vocabulary. Byte fields
 * are decoded strings; `algorithm` and `critical` are always present, the rest
 * may be `undefined`.
 */
export type DomainTokenHeader = {
  algorithm: TokenHeaderAlgorithm;
  baseFormat: BaseTokenFormat | undefined;
  certificateChain: Array<string> | undefined;
  certificateThumbprint: string | undefined;
  certificateThumbprintSha1: string | undefined;
  certificateUrl: string | undefined;
  contentType: string | undefined;
  critical: Array<string>;
  encryption: KryptosEncryption | undefined;
  headerType: string | undefined;
  initialisationVector: string | undefined;
  jwk: KryptosJwk | undefined;
  jwksUri: string | undefined;
  keyId: string | undefined;
  objectId: string | undefined;
  partyProducer: string | undefined; // apu — ECDH-ES Agreement PartyUInfo
  partyRecipient: string | undefined; // apv — ECDH-ES Agreement PartyVInfo
  pbkdfIterations: number | undefined;
  pbkdfSalt: string | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionTag: string | undefined;
  tokenType: string | undefined;
  zip: string | undefined;
};

/**
 * Caller-supplyable header options — DERIVED from {@link DomainTokenHeader}:
 * every field optional, MINUS the fields the kit derives/computes rather than
 * the caller setting (baseFormat, tokenType, cert chain + SHA-256 thumbprint).
 * The byte fields are raw Buffers on the way in, and `headerType` is open.
 */
export type DomainTokenHeaderOptions = Partial<
  Omit<
    DomainTokenHeader,
    | "baseFormat"
    | "tokenType"
    | "certificateChain"
    | "certificateThumbprint"
    | "certificateThumbprintSha1"
    | "headerType"
    | "initialisationVector"
    | "pbkdfSalt"
    | "publicEncryptionTag"
  >
> & {
  headerType?: TokenHeaderType;
  initialisationVector?: Buffer;
  pbkdfSalt?: Buffer;
  publicEncryptionTag?: Buffer;
};

/** The cert-binding output — DERIVED from {@link DomainTokenHeader}. */
export type CertificateHeaderFields = Partial<
  Pick<
    DomainTokenHeader,
    "certificateChain" | "certificateThumbprint" | "certificateThumbprintSha1"
  >
>;

export type BindCertificateMode = "thumbprint" | "chain" | "none";

export type CertificateBindingMode = "strict" | "lax";

/** A {@link DomainTokenHeader} refined once the token's alg/format/typ are known. */
export type RefinedDomainTokenHeader<A> = Omit<
  DomainTokenHeader,
  "algorithm" | "baseFormat" | "headerType"
> & {
  algorithm: A;
  baseFormat: BaseTokenFormat;
  headerType: string;
};
