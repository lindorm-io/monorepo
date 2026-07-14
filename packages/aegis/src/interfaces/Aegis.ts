import type {
  AesContent,
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "@lindorm/aes";
import type { Dict } from "@lindorm/types";
import type {
  AegisDecryptKey,
  AegisEncKey,
  DecryptedJwe,
  EncryptedJwe,
  JweEncryptOptions,
  JwsContent,
  ParsedJws,
  ParsedJwt,
  ProfileContent,
  ProfileSignOptions,
  ProfileVerifyOptions,
  RawSignInput,
  SignContent,
  SignJwsOptions,
  SignJwtContent,
  SignJwtOptions,
  SignedJws,
  SignedJwt,
  TokenProfile,
  VerifyJwtOptions,
} from "../types/index.js";

/**
 * The AES surface takes the SAME key selector as every other aegis operation:
 * the deployment default (`AegisOptions.encrypt` / `.decrypt`) merged with a
 * per-call `key`, resolved through the one resolver, floored like the rest.
 *
 * It exists because one Aegis serves a whole deployment: a pylon encrypts a
 * COOKIE with its internal `dir` key and an id_token to the CLIENT's key, and
 * only a per-call selector can tell those two apart — `{ predicate: { purpose:
 * "cookie", publish: false } }` reaches the internal key that exists for
 * exactly that job.
 */
export interface IAegisAes {
  encrypt(data: AesContent, mode?: "encoded", key?: AegisEncKey): Promise<string>;
  encrypt(
    data: AesContent,
    mode: "record",
    key?: AegisEncKey,
  ): Promise<AesEncryptionRecord>;
  encrypt(
    data: AesContent,
    mode: "serialised",
    key?: AegisEncKey,
  ): Promise<SerialisedAesEncryption>;
  encrypt(data: AesContent, mode: "tokenised", key?: AegisEncKey): Promise<string>;
  decrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    key?: AegisDecryptKey,
  ): Promise<T>;
}

export interface IAegisJwe {
  encrypt(data: string, options?: JweEncryptOptions): Promise<EncryptedJwe>;
  decrypt(token: string): Promise<DecryptedJwe>;
}

export interface IAegisJws {
  sign<T extends JwsContent>(data: T, options?: SignJwsOptions): Promise<SignedJws>;
  verify<T extends JwsContent>(token: string): Promise<ParsedJws<T>>;
}

export interface IAegisJwt {
  sign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options?: SignJwtOptions,
  ): Promise<SignedJwt>;
  verify<T extends Dict = Dict>(
    token: string,
    verify?: VerifyJwtOptions,
  ): Promise<ParsedJwt<T>>;
}

export interface IAegis {
  issuer: string | null;

  aes: IAegisAes;

  jwe: IAegisJwe;
  jws: IAegisJws;
  jwt: IAegisJwt;

  registerProfile(profile: TokenProfile): void;

  sign(input: RawSignInput): Promise<SignedJws>;

  mint<P extends keyof ProfileContent>(
    profile: P,
    content: ProfileContent[P],
    options?: ProfileSignOptions,
  ): Promise<SignedJwt>;
  mint(
    profile: string & {},
    content: SignContent,
    options?: ProfileSignOptions,
  ): Promise<SignedJwt>;

  verify(token: string): Promise<ParsedJwt | ParsedJws<any>>;
  verify<T extends ParsedJws<any>>(token: string): Promise<T>;
  verify<T extends ParsedJwt>(token: string, options?: VerifyJwtOptions): Promise<T>;
  verify<T extends ParsedJwt>(
    profile: string,
    token: string,
    options: ProfileVerifyOptions,
  ): Promise<T>;
}
