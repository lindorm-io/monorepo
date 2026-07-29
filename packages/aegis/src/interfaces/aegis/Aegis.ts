import type { Condition } from "@lindorm/match";
import type {
  AesContent,
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "@lindorm/aes";
import type { Dict } from "@lindorm/types";
import type { BuiltInProfiles } from "../../internal/profiles/built-in-profiles.js";
import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type {
  AegisDecryptKey,
  AegisEncKey,
  AegisSignKey,
  AegisVerifyKey,
  AesDecryptOptions,
  AesEncryptOptions,
  CweEncryptOptions,
  CwtClaimsWire,
  DecryptedEncryptedToken,
  DecryptedToken,
  DecryptOptions,
  DecryptTokenOptions,
  DomainAssert,
  EncryptData,
  EncryptedToken,
  EncryptOptions,
  JweEncryptOptions,
  JwtClaimsWire,
  NarrowedToken,
  ParsedToken,
  ProfileContent,
  ProfileMintOptions,
  ProfileVerifyOptions,
  RawSignInput,
  SignContent,
  SignedToken,
  SignStructuredTokenOptions,
  SignUnstructuredTokenOptions,
  TokenContent,
  TokenProfile,
  VerifiedStructuredToken,
  VerifiedToken,
  VerifiedUnstructuredToken,
  VerifyOptions,
  VerifyStructuredTokenOptions,
  VerifyUnstructuredTokenOptions,
} from "../../types/index.js";

/**
 * The AES surface takes the SAME key selector as every other aegis operation:
 * the deployment default (`AegisSettings.encrypt` / `.decrypt`) merged with a
 * per-call `key`, resolved through the one resolver, floored like the rest.
 *
 * It exists because one Aegis serves a whole deployment: a pylon encrypts a
 * COOKIE with its internal `dir` key and an id_token to the CLIENT's key, and
 * only a per-call selector can tell those two apart — `{ predicate: { purpose:
 * "cookie", publish: false } }` reaches the internal key that exists for
 * exactly that job.
 */
export interface IAegisAes {
  encrypt(data: AesContent, options?: AesEncryptOptions): Promise<string>;
  encrypt(data: AesContent, mode: "cbor", options?: AesEncryptOptions): Promise<string>;
  encrypt(
    data: AesContent,
    mode: "record",
    options?: AesEncryptOptions,
  ): Promise<AesEncryptionRecord>;
  encrypt(
    data: AesContent,
    mode: "serialised",
    options?: AesEncryptOptions,
  ): Promise<SerialisedAesEncryption>;
  decrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesDecryptOptions,
  ): Promise<T>;
}

export interface IAegisJwe {
  encrypt(
    data: TokenContent,
    options?: JweEncryptOptions & { key?: AegisEncKey },
  ): Promise<EncryptedToken>;
  decrypt<T extends TokenContent = Buffer>(
    token: string,
    options?: DecryptTokenOptions & { key?: AegisDecryptKey },
  ): Promise<DecryptedEncryptedToken<T, string>>;
}

// The COSE namespace family — the wire-for-wire COSE counterpart of the JOSE
// namespaces. `cwe` mirrors `jwe` (COSE_Encrypt0), `cws` mirrors `jws` (raw
// COSE_Sign1), `cwt` mirrors `jwt` (generic CWT with standard claims). Same
// ergonomic surface, same key resolution; only the wire encoding differs.
export interface IAegisCwe {
  encrypt(
    data: TokenContent,
    options?: CweEncryptOptions & { key?: AegisEncKey },
  ): Promise<EncryptedToken>;
  decrypt<T extends TokenContent = Buffer>(
    token: string,
    options?: DecryptTokenOptions & { key?: AegisDecryptKey },
  ): Promise<DecryptedEncryptedToken<T, Buffer>>;
}

export interface IAegisCws {
  sign(
    data: TokenContent,
    options?: SignUnstructuredTokenOptions & { key?: AegisSignKey; omit?: OmitMode },
  ): Promise<SignedToken>;
  verify<T extends TokenContent = Buffer>(
    token: string,
    options?: VerifyUnstructuredTokenOptions & { key?: AegisVerifyKey },
  ): Promise<VerifiedUnstructuredToken<T, Buffer>>;
}

export interface IAegisCwt {
  sign<C extends Dict = Dict>(
    claims: CwtClaimsWire & C,
    options?: SignStructuredTokenOptions & { key?: AegisSignKey },
  ): Promise<SignedToken>;
  verify<C extends Dict = Dict>(
    token: string,
    assert?: Condition<CwtClaimsWire & C>,
    options?: VerifyStructuredTokenOptions & { key?: AegisVerifyKey },
  ): Promise<VerifiedStructuredToken<CwtClaimsWire & C>>;
}

// The COSE_Mac0 (symmetric) claims twin of `IAegisCwt` (D6). Same ergonomic
// surface; only the integrity structure differs (a MAC, not a signature).
export interface IAegisCwm {
  sign<C extends Dict = Dict>(
    claims: CwtClaimsWire & C,
    options?: SignStructuredTokenOptions & { key?: AegisSignKey },
  ): Promise<SignedToken>;
  verify<C extends Dict = Dict>(
    token: string,
    assert?: Condition<CwtClaimsWire & C>,
    options?: VerifyStructuredTokenOptions & { key?: AegisVerifyKey },
  ): Promise<VerifiedStructuredToken<CwtClaimsWire & C>>;
}

export interface IAegisJws {
  sign(
    data: TokenContent,
    options?: SignUnstructuredTokenOptions & { key?: AegisSignKey },
  ): Promise<SignedToken>;
  verify<T extends TokenContent = Buffer>(
    token: string,
    options?: VerifyUnstructuredTokenOptions & { key?: AegisVerifyKey },
  ): Promise<VerifiedUnstructuredToken<T, string>>;
}

export interface IAegisJwt {
  sign<C extends Dict = Dict>(
    claims: JwtClaimsWire & C,
    options?: SignStructuredTokenOptions & { key?: AegisSignKey },
  ): Promise<SignedToken>;
  verify<C extends Dict = Dict>(
    token: string,
    assert?: Condition<JwtClaimsWire & C>,
    options?: VerifyStructuredTokenOptions & { key?: AegisVerifyKey },
  ): Promise<VerifiedStructuredToken<JwtClaimsWire & C, string>>;
}

export interface IAegis {
  issuer: string | null;

  aes: IAegisAes;

  cwe: IAegisCwe;
  cwm: IAegisCwm;
  cws: IAegisCws;
  cwt: IAegisCwt;

  jwe: IAegisJwe;
  jws: IAegisJws;
  jwt: IAegisJwt;

  registerProfile(profile: TokenProfile): void;

  sign(input: RawSignInput): Promise<SignedToken>;

  encrypt(data: EncryptData, options?: EncryptOptions): Promise<EncryptedToken>;

  decrypt<C extends Dict = Dict>(
    token: string,
    options?: DecryptOptions,
  ): Promise<DecryptedToken<C>>;

  /**
   * The KEYLESS, UNVERIFIED domain read of ALL seven wire formats: a structured
   * token yields its header + claims buckets, an unstructured one its header +
   * opaque payload, an encrypted one its header alone (the content is ciphertext).
   * Every format ALWAYS yields the header; `dpop` (a verify-only artefact) never
   * appears. Use `verify` for an authenticity guarantee.
   */
  parse<C extends Dict = Dict>(token: string): ParsedToken<C>;

  mint<P extends keyof ProfileContent>(
    profile: P,
    content: ProfileContent[P],
    options?: ProfileMintOptions,
  ): Promise<SignedToken>;
  mint(
    profile: string & {},
    content: SignContent,
    options?: ProfileMintOptions,
  ): Promise<SignedToken>;

  verify<P extends keyof BuiltInProfiles>(
    profile: P,
    token: string,
    assert: DomainAssert | undefined,
    options: ProfileVerifyOptions,
  ): Promise<NarrowedToken<BuiltInProfiles[P]>>;
  verify(
    profile: string & {},
    token: string,
    assert: DomainAssert | undefined,
    options: ProfileVerifyOptions,
  ): Promise<VerifiedToken>;
  verify<C extends Dict = Dict>(
    token: string,
    assert?: DomainAssert,
    options?: VerifyOptions,
  ): Promise<VerifiedToken<C>>;
}
