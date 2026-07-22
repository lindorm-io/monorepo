import type { WireTokenHeader } from "../header/header.js";

export type DecodedJwe = {
  header: WireTokenHeader;
  publicEncryptionKey: string | undefined;
  initialisationVector: string;
  content: string;
  authTag: string;
};
