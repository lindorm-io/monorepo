import { KryptosEncryption } from "@lindorm/kryptos";
import { CoseProtectedHeaderKey } from "#internal/constants/cose";
import { RawTokenHeaderClaims, TokenHeaderClaims } from "../header";

// RFC 9052: protected alg = content encryption (KryptosEncryption),
// recipient alg = key management (TokenHeaderAlgorithm via RawTokenHeaderClaims)
export type DecodedCwe = {
  protected: Pick<TokenHeaderClaims, Exclude<CoseProtectedHeaderKey, "alg">> & {
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
