import { Dict } from "@lindorm/types";
import {
  DecodedJwe,
  DecodedJws,
  DecodedJwt,
  DecryptedJwe,
  EncryptedJwe,
  JweEncryptOptions,
  JwsContent,
  SignJwsOptions,
  SignJwtContent,
  SignJwtOptions,
  SignedJws,
  SignedJwt,
  VerifiedJws,
  VerifiedJwt,
  VerifyJwtOptions,
} from "../types";

export interface IAegisJwe {
  encrypt(data: string, options?: JweEncryptOptions): Promise<EncryptedJwe>;
  decrypt(jwe: string): Promise<DecryptedJwe>;
}

export interface IAegisJws {
  sign<T extends JwsContent>(data: T, options?: SignJwsOptions): Promise<SignedJws>;
  verify<T extends JwsContent>(jws: string): Promise<VerifiedJws<T>>;
}

export interface IAegisJwt {
  sign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options?: SignJwtOptions,
  ): Promise<SignedJwt>;
  verify<T extends Dict = Dict>(
    jwt: string,
    verify?: VerifyJwtOptions,
  ): Promise<VerifiedJwt<T>>;
}

export interface IAegis {
  issuer: string | null;

  jwe: IAegisJwe;
  jws: IAegisJws;
  jwt: IAegisJwt;

  decode<T extends DecodedJwe | DecodedJws | DecodedJwt>(token: string): T;
  verify<T extends VerifiedJwt | VerifiedJws<any>>(token: string): Promise<T>;
}
