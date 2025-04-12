import { RawTokenHeaderClaims, TokenHeaderClaims } from "../header";

export type DecodedCoseEncrypt = {
  protected: Pick<TokenHeaderClaims, "alg" | "cty" | "typ">;
  unprotected: Pick<RawTokenHeaderClaims, "iv" | "oid">;
  recipient: {
    unprotected: Pick<
      RawTokenHeaderClaims,
      "enc" | "epk" | "hkdf_salt" | "iv" | "jku" | "kid" | "p2c" | "p2s" | "tag"
    >;
    initialisationVector: Buffer | undefined;
    publicEncryptionKey: Buffer | undefined;
  };
  initialisationVector: Buffer;
  content: Buffer;
  authTag: Buffer;
};
