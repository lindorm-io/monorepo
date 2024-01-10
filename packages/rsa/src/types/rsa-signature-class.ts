import { KeySet } from "@lindorm-io/jwk";
import { BufferFormat, KeyObject, SignatureAlgorithm } from "./types";

export type RsaSignatureOptions = {
  algorithm?: SignatureAlgorithm;
  format?: BufferFormat;
  key?: KeyObject;
  keySet?: KeySet;
};
