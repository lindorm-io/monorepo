import type {
  AesContent,
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "@lindorm/aes";
import type { Dict, Predicate } from "@lindorm/types";
import type {
  AegisSignKey,
  AegisVerifyKey,
  AesDecryptOptions,
  AesEncryptOptions,
  CweContent,
  CweDecryptOptions,
  CweEncryptOptions,
  CwsContent,
  CwtWireClaims,
  DecryptedCwe,
  DecryptedJwe,
  DecryptedToken,
  DecryptOptions,
  DomainAssert,
  EncryptData,
  EncryptedCwe,
  EncryptedJwe,
  EncryptedToken,
  EncryptOptions,
  JwtWireClaims,
  ParsedCws,
  ParsedCwt,
  JweDecryptOptions,
  JweEncryptOptions,
  JwsContent,
  NarrowedToken,
  ParsedJws,
  ParsedJwt,
  ProfileContent,
  ProfileMintOptions,
  ProfileVerifyOptions,
  RawSignInput,
  SignContent,
  SignCwsOptions,
  SignCwtOptions,
  SignedCws,
  SignedCwt,
  SignJwsOptions,
  SignJwtWireOptions,
  SignedJws,
  SignedJwt,
  TokenProfile,
  VerifiedToken,
  VerifyCwsOptions,
  VerifyCwtOptions,
  VerifyJwsOptions,
  VerifyJwtWireOptions,
  VerifyOptions,
} from "../../types/index.js";
import type { BuiltInProfiles } from "../../internal/profiles/built-in-profiles.js";

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
  encrypt(data: string, options?: JweEncryptOptions): Promise<EncryptedJwe>;
  decrypt(token: string, options?: JweDecryptOptions): Promise<DecryptedJwe>;
}

// The COSE namespace family — the wire-for-wire COSE counterpart of the JOSE
// namespaces. `cwe` mirrors `jwe` (COSE_Encrypt0), `cws` mirrors `jws` (raw
// COSE_Sign1), `cwt` mirrors `jwt` (generic CWT with standard claims). Same
// ergonomic surface, same key resolution; only the wire encoding differs.
export interface IAegisCwe {
  encrypt(data: CweContent, options?: CweEncryptOptions): Promise<EncryptedCwe>;
  decrypt(token: string, options?: CweDecryptOptions): Promise<DecryptedCwe>;
}

export interface IAegisCws {
  sign(data: CwsContent, options?: SignCwsOptions): Promise<SignedCws>;
  verify(token: string, options?: VerifyCwsOptions): Promise<ParsedCws>;
}

export interface IAegisCwt {
  sign<C extends CwtWireClaims = CwtWireClaims>(
    claims: C,
    options?: SignCwtOptions,
  ): Promise<SignedCwt>;
  verify<C extends CwtWireClaims = CwtWireClaims>(
    token: string,
    assert?: Predicate<C>,
    options?: VerifyCwtOptions,
  ): Promise<ParsedCwt<C>>;
}

// The COSE_Mac0 (symmetric) claims twin of `IAegisCwt` (D6). Same ergonomic
// surface; only the integrity structure differs (a MAC, not a signature).
export interface IAegisCwm {
  sign<C extends CwtWireClaims = CwtWireClaims>(
    claims: C,
    options?: SignCwtOptions,
  ): Promise<SignedCwt>;
  verify<C extends CwtWireClaims = CwtWireClaims>(
    token: string,
    assert?: Predicate<C>,
    options?: VerifyCwtOptions,
  ): Promise<ParsedCwt<C>>;
}

export interface IAegisJws {
  sign<T extends JwsContent>(data: T, options?: SignJwsOptions): Promise<SignedJws>;
  verify<T extends JwsContent>(
    token: string,
    options?: VerifyJwsOptions,
  ): Promise<ParsedJws<T>>;
}

export interface IAegisJwt {
  sign<C extends JwtWireClaims = JwtWireClaims>(
    claims: C,
    options?: SignJwtWireOptions & { key?: AegisSignKey },
  ): Promise<SignedJwt>;
  verify<C extends JwtWireClaims = JwtWireClaims>(
    token: string,
    assert?: Predicate<C>,
    options?: VerifyJwtWireOptions & { key?: AegisVerifyKey },
  ): Promise<ParsedJwt<C>>;
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

  sign(input: RawSignInput): Promise<SignedJws>;

  encrypt(data: EncryptData, options?: EncryptOptions): Promise<EncryptedToken>;

  decrypt<C extends Dict = Dict>(
    token: string,
    options?: DecryptOptions,
  ): Promise<DecryptedToken<C>>;

  mint<P extends keyof ProfileContent>(
    profile: P,
    content: ProfileContent[P],
    options?: ProfileMintOptions,
  ): Promise<SignedJwt>;
  mint(
    profile: string & {},
    content: SignContent,
    options?: ProfileMintOptions,
  ): Promise<SignedJwt>;

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
