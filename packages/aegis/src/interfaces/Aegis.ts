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

  jwe: IAegisJwe;
  jws: IAegisJws;
  jwt: IAegisJwt;

  // decode<T extends DecodedJwe | RawJws | DecodedJwt>(token: string): T;
  verify<T extends ParsedJwt | ParsedJws<any>>(
    token: string,
    options?: VerifyJwtOptions,
  ): Promise<T>;
}
