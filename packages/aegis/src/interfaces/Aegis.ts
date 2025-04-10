import {
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "@lindorm/aes";
import { Dict } from "@lindorm/types";
import {
  CoseSignContent,
  DecryptedJwe,
  EncryptedJwe,
  JweEncryptOptions,
  JwsContent,
  ParsedCoseSign,
  ParsedCwt,
  ParsedJws,
  ParsedJwt,
  SignCoseSignOptions,
  SignCwtContent,
  SignCwtOptions,
  SignJwsOptions,
  SignJwtContent,
  SignJwtOptions,
  SignedCoseSign,
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

export interface IAegisCose {
  sign<T extends CoseSignContent>(
    data: T,
    options?: SignCoseSignOptions,
  ): Promise<SignedCoseSign>;
  verify<T extends CoseSignContent>(token: string): Promise<ParsedCoseSign<T>>;
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

  cose: IAegisCose;
  cwt: IAegisCwt;

  jwe: IAegisJwe;
  jws: IAegisJws;
  jwt: IAegisJwt;

  verify<T extends ParsedJws<any>>(token: string): Promise<T>;
  verify<T extends ParsedJwt>(token: string, options?: VerifyJwtOptions): Promise<T>;
}
