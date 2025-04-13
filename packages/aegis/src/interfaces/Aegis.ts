import {
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "@lindorm/aes";
import { Dict } from "@lindorm/types";
import {
  CweContent,
  CweEncryptOptions,
  CwsContent,
  DecryptedCwe,
  DecryptedJwe,
  EncryptedCwe,
  EncryptedJwe,
  JweEncryptOptions,
  JwsContent,
  ParsedCws,
  ParsedCwt,
  ParsedJws,
  ParsedJwt,
  SignCwsOptions,
  SignCwtContent,
  SignCwtOptions,
  SignJwsOptions,
  SignJwtContent,
  SignJwtOptions,
  SignedCws,
  SignedCwt,
  SignedJws,
  SignedJwt,
  VerifyCwtOptions,
  VerifyJwtOptions,
} from "../types";

export interface IAegisAes {
  encrypt(data: string, mode?: "encoded"): Promise<string>;
  encrypt(data: string, mode: "record"): Promise<AesEncryptionRecord>;
  encrypt(data: string, mode: "serialised"): Promise<SerialisedAesEncryption>;
  encrypt(data: string, mode: "tokenised"): Promise<string>;
  decrypt(data: AesDecryptionRecord | SerialisedAesDecryption | string): Promise<string>;
}

export interface IAegisCwe {
  encrypt(data: CweContent, options?: CweEncryptOptions): Promise<EncryptedCwe>;
  decrypt<T extends CweContent = string>(token: CweContent): Promise<DecryptedCwe<T>>;
}

export interface IAegisCws {
  sign(data: CwsContent, options?: SignCwsOptions): Promise<SignedCws>;
  verify<T extends CwsContent>(token: CwsContent): Promise<ParsedCws<T>>;
}

export interface IAegisCwt {
  sign<T extends Dict = Dict>(
    content: SignCwtContent<T>,
    options?: SignCwtOptions,
  ): Promise<SignedCwt>;
  verify<T extends Dict = Dict>(
    token: string,
    verify?: VerifyCwtOptions,
  ): Promise<ParsedCwt<T>>;
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

  cwe: IAegisCwe;
  cws: IAegisCws;
  cwt: IAegisCwt;

  jwe: IAegisJwe;
  jws: IAegisJws;
  jwt: IAegisJwt;

  verify<T extends ParsedJws<any>>(token: string): Promise<T>;
  verify<T extends ParsedJwt>(token: string, options?: VerifyJwtOptions): Promise<T>;
}
