import { KryptosEncryption } from "@lindorm/kryptos";
import { RawTokenHeaderClaims, TokenHeaderClaims } from "../header";

// RFC 9052: protected alg = content encryption (KryptosEncryption),
// recipient alg = key management (TokenHeaderAlgorithm via RawTokenHeaderClaims)
export type DecodedCwe = {
  protected: Omit<Pick<TokenHeaderClaims, "alg" | "cty" | "typ">, "alg"> & {
    alg: KryptosEncryption;
  };
  protectedCbor: Buffer;
  unprotected: Pick<RawTokenHeaderClaims, "iv" | "oid">;
  recipient: {
    unprotected: Pick<RawTokenHeaderClaims, "alg" | "epk" | "kid">;
    initialisationVector: Buffer | undefined;
    publicEncryptionKey: Buffer | undefined;
  };
  initialisationVector: Buffer;
  content: Buffer;
  authTag: Buffer;
};
