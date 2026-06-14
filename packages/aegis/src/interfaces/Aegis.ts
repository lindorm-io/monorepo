import type {
  AesContent,
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "@lindorm/aes";
import type { Dict } from "@lindorm/types";
import type {
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

export interface IAegisAes {
  encrypt(data: AesContent, mode?: "encoded"): Promise<string>;
  encrypt(data: AesContent, mode: "record"): Promise<AesEncryptionRecord>;
  encrypt(data: AesContent, mode: "serialised"): Promise<SerialisedAesEncryption>;
  encrypt(data: AesContent, mode: "tokenised"): Promise<string>;
  decrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
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
