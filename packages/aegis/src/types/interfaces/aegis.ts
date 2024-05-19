import { Dict } from "@lindorm/types";
import { DecryptedJwe, EncryptedJwe, JweEncryptOptions } from "../jwe";
import { JwsContent, SignJwsOptions, SignedJws, VerifiedJws } from "../jws";
import {
  SignJwtContent,
  SignJwtOptions,
  SignedJwt,
  VerifiedJwt,
  VerifyJwtOptions,
} from "../jwt";

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
  jwe: IAegisJwe;
  jws: IAegisJws;
  jwt: IAegisJwt;
}
