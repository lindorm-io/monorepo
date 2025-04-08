import {
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "@lindorm/aes";
import { Dict } from "@lindorm/types";
import {
  DecryptedJwe,
  EncryptedJwe,
  JweEncryptOptions,
  JwsContent,
  ParsedJws,
  ParsedJwt,
  SignJwsOptions,
  SignJwtContent,
  SignJwtOptions,
  SignedJws,
  SignedJwt,
  VerifyJwtOptions,
} from "../types";

export interface IAegisAes {
  encrypt(data: string, mode?: "encoded"): Promise<string>;
  encrypt(data: string, mode: "record"): Promise<AesEncryptionRecord>;
  encrypt(data: string, mode: "serialised"): Promise<SerialisedAesEncryption>;
  encrypt(data: string, mode: "tokenised"): Promise<string>;
  decrypt(data: AesDecryptionRecord | SerialisedAesDecryption | string): Promise<string>;
}

export interface IAegisJwe {
  encrypt(data: string, options?: JweEncryptOptions): Promise<EncryptedJwe>;
  decrypt(jwe: string): Promise<DecryptedJwe>;
}

export interface IAegisJws {
  sign<T extends JwsContent>(data: T, options?: SignJwsOptions): Promise<SignedJws>;
  verify<T extends JwsContent>(jws: string): Promise<ParsedJws<T>>;
}

export interface IAegisJwt {
  sign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options?: SignJwtOptions,
  ): Promise<SignedJwt>;
  verify<T extends Dict = Dict>(
    jwt: string,
    verify?: VerifyJwtOptions,
  ): Promise<ParsedJwt<T>>;
}

export interface IAegis {
  issuer: string | null;

  aes: IAegisAes;
  jwe: IAegisJwe;
  jws: IAegisJws;
  jwt: IAegisJwt;

  verify<T extends ParsedJws<any>>(jws: string): Promise<T>;
  verify<T extends ParsedJwt>(jwt: string, options?: VerifyJwtOptions): Promise<T>;
}
