import type { TokenHeaderClaims } from "../header.js";

export type DecodedJwe = {
  header: TokenHeaderClaims;
  publicEncryptionKey: string | undefined;
  initialisationVector: string;
  content: string;
  authTag: string;
};
