import { RawTokenHeaderClaims, TokenHeaderClaims } from "../header";

export type DecodedCwe = {
  protected: Pick<TokenHeaderClaims, "alg" | "cty" | "typ">;
  protectedCbor: Buffer;
  unprotected: Pick<RawTokenHeaderClaims, "iv" | "oid">;
  recipient: {
    unprotected: Pick<
      RawTokenHeaderClaims,
      "enc" | "epk" | "iv" | "jku" | "kid" | "p2c" | "p2s" | "tag"
    >;
    initialisationVector: Buffer | undefined;
    publicEncryptionKey: Buffer | undefined;
  };
  initialisationVector: Buffer;
  content: Buffer;
  authTag: Buffer;
};
