import { TokenHeaderClaims } from "../header";

export type DecodedJwe = {
  header: TokenHeaderClaims;
  publicEncryptionKey: string | undefined;
  initialisationVector: string;
  content: string;
  authTag: string | undefined;
};
