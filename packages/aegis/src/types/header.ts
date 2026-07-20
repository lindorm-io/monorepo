import type { PublicEncryptionJwk } from "@lindorm/aes";
import type { KryptosEncryption, KryptosJwk } from "@lindorm/kryptos";
import type {
  TOKEN_HEADER_ALGORITHMS,
  TOKEN_HEADER_TYPES,
} from "../internal/constants/header.js";

export type TokenHeaderAlgorithm = (typeof TOKEN_HEADER_ALGORITHMS)[number];

/** The closed base token format set — derived from the constant (no duplicate literal). */
export type BaseTokenFormat = (typeof TOKEN_HEADER_TYPES)[number]; // "JWE" | "JWS" | "JWT"

/** The `typ` header value: a base format, or any other registered media type (e.g. "at+jwt"). */
export type TokenHeaderType = BaseTokenFormat | (string & {});

// --- WIRE (JOSE-named) — ONE canonical type; the rest derive from it ---------

/**
 * THE wire type: the serialized JOSE protected header (RFC 7515 §4.1). Byte
 * fields (iv/p2s/tag) are base64url strings and `alg` is fixed — this is the
 * shape actually decoded off the wire.
 */
export type WireTokenHeader = {
  alg: TokenHeaderAlgorithm; // algorithm
  apu?: string; // ecdh-es party u info
  apv?: string; // ecdh-es party v info
  crit?: Array<string>;
  cty?: string; // content type
  enc?: KryptosEncryption; // encryption
  epk?: PublicEncryptionJwk; // public encryption jwk
  iv?: string; // public encryption iv
  jku?: string; // jwks uri
  jwk?: KryptosJwk; // jwk
  kid?: string; // key id
  oid?: string; // object id
  p2c?: number; // p2c
  p2s?: string; // p2s
  tag?: string; // public encryption tag
  typ?: string; // header type (optional per RFC 7515 §4.1.9)
  x5c?: Array<string>;
  x5t?: string;
  "x5t#S256"?: string;
  x5u?: string; // x.509 url
  zip?: string; // compression algorithm
};

/**
 * The pre-serialization wire header — DERIVED from {@link WireTokenHeader}: `alg`
 * is not yet fixed, the byte fields are still raw Buffers (base64url-encoded
 * downstream), and `typ` is the open header-type union.
 */
export type WireTokenHeaderOptions = Omit<
  WireTokenHeader,
  "alg" | "iv" | "p2s" | "tag" | "typ"
> & {
  alg?: TokenHeaderAlgorithm;
  iv?: Buffer;
  p2s?: Buffer;
  tag?: Buffer;
  typ?: TokenHeaderType;
};

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

export type TokenEncryptOrSignOptions = Pick<DomainTokenHeaderOptions, "jwk">;

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
